import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

// 从 vod_play_url 解析 m3u8 集数链接：按 $$$ 拆分线路，选择最长（集数最多）的那条
function parseEpisodes(vod_play_url: string | undefined): string[] {
  if (!vod_play_url) return [];
  const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
  let episodes: string[] = [];
  const lines = vod_play_url.split('$$$');
  lines.forEach((url: string) => {
    const matches = url.match(m3u8Regex) || [];
    if (matches.length > episodes.length) {
      episodes = matches;
    }
  });
  return Array.from(new Set(episodes)).map((link: string) => {
    link = link.substring(1); // 去掉开头的 $
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });
}

function mapItemToResult(item: ApiSearchItem, apiSite: ApiSite): SearchResult {
  return {
    id: item.vod_id.toString(),
    title: item.vod_name.trim().replace(/\s+/g, ' '),
    poster: item.vod_pic,
    episodes: parseEpisodes(item.vod_play_url),
    source: apiSite.key,
    source_name: apiSite.name,
    class: item.vod_class,
    year: item.vod_year
      ? item.vod_year.match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(item.vod_content || ''),
    type_name: item.type_name,
    douban_id: item.vod_douban_id,
  };
}

// 拉取单页数据：区分超时 / HTTP 错误 / JSON 解析错误 / 空 list 四种情形
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSearchPage(
  url: string,
  headers: HeadersInit,
  timeoutMs: number,
  sourceName: string,
  pageNum: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[搜索] ${sourceName} 第${pageNum}页 HTTP错误: status=${response.status}`
      );
      return null;
    }
    try {
      return await response.json();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        `[搜索] ${sourceName} 第${pageNum}页 JSON解析失败:`,
        (e as Error).message
      );
      return null;
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // eslint-disable-next-line no-console
      console.error(
        `[搜索] ${sourceName} 第${pageNum}页 请求超时(${timeoutMs}ms)`
      );
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `[搜索] ${sourceName} 第${pageNum}页 网络错误:`,
        (error as Error).message
      );
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchFromApi(
  apiSite: ApiSite,
  query: string
): Promise<SearchResult[]> {
  const apiBaseUrl = apiSite.api;
  const apiName = apiSite.name;
  const startTime = Date.now();

  // 动态生成 Referer 为源站根地址
  let referer = apiBaseUrl;
  try {
    const u = new URL(apiBaseUrl);
    referer = `${u.protocol}//${u.host}/`;
  } catch {
    // 保持原值兜底
  }
  const headers: HeadersInit = {
    ...API_CONFIG.search.headers,
    Referer: referer,
  };

  try {
    const apiUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);

    const data = await fetchSearchPage(apiUrl, headers, 10000, apiName, 1);
    if (!data) {
      // eslint-disable-next-line no-console
      console.log(
        `[搜索] ${apiName} 完成，耗时${Date.now() - startTime}ms，命中0个`
      );
      return [];
    }

    // 苹果CMS 标准返回 code:1 表示成功
    if (data.code !== undefined && data.code !== 1) {
      // eslint-disable-next-line no-console
      console.error(
        `[搜索] ${apiName} 第1页 接口错误码: code=${data.code}, msg=${
          data.msg || ''
        }`
      );
      // eslint-disable-next-line no-console
      console.log(
        `[搜索] ${apiName} 完成，耗时${Date.now() - startTime}ms，命中0个`
      );
      return [];
    }

    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      // eslint-disable-next-line no-console
      console.error(`[搜索] ${apiName} 第1页 空list`);
      // eslint-disable-next-line no-console
      console.log(
        `[搜索] ${apiName} 完成，耗时${Date.now() - startTime}ms，命中0个`
      );
      return [];
    }

    // 处理第一页结果，过滤掉 episodes 为空的条目
    const results = (data.list as ApiSearchItem[])
      .map((item) => mapItemToResult(item, apiSite))
      .filter((r) => r.episodes.length > 0);

    const config = await getConfig();
    const MAX_SEARCH_PAGES: number = config.SiteConfig.SearchDownstreamMaxPage;

    // 获取总页数
    const pageCount = data.pagecount || 1;
    // 确定需要获取的额外页数
    const pagesToFetch = Math.min(pageCount - 1, MAX_SEARCH_PAGES - 1);

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', page.toString());

        const pagePromise = (async () => {
          const pageData = await fetchSearchPage(
            pageUrl,
            headers,
            6000,
            apiName,
            page
          );
          if (!pageData) return [] as SearchResult[];

          if (pageData.code !== undefined && pageData.code !== 1) {
            // eslint-disable-next-line no-console
            console.error(
              `[搜索] ${apiName} 第${page}页 接口错误码: code=${
                pageData.code
              }, msg=${pageData.msg || ''}`
            );
            return [] as SearchResult[];
          }

          if (
            !pageData.list ||
            !Array.isArray(pageData.list) ||
            pageData.list.length === 0
          ) {
            // eslint-disable-next-line no-console
            console.error(`[搜索] ${apiName} 第${page}页 空list`);
            return [] as SearchResult[];
          }

          return (pageData.list as ApiSearchItem[])
            .map((item) => mapItemToResult(item, apiSite))
            .filter((r) => r.episodes.length > 0);
        })();

        additionalPagePromises.push(pagePromise);
      }

      // 等待所有额外页的结果
      const additionalResults = await Promise.all(additionalPagePromises);

      // 合并所有页的结果
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[搜索] ${apiName} 完成，耗时${Date.now() - startTime}ms，命中${
        results.length
      }个`
    );
    return results;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[搜索] ${apiName} 异常:`, (error as Error).message);
    // eslint-disable-next-line no-console
    console.log(
      `[搜索] ${apiName} 完成，耗时${Date.now() - startTime}ms，命中0个`
    );
    return [];
  }
}

// 匹配 m3u8 链接的正则
const M3U8_PATTERN = /(https?:\/\/[^"'\s]+?\.m3u8)/g;

export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string
): Promise<SearchResult> {
  if (apiSite.detail) {
    return handleSpecialSourceDetail(id, apiSite);
  }

  const detailUrl = `${apiSite.api}${API_CONFIG.detail.path}${id}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (
    !data ||
    !data.list ||
    !Array.isArray(data.list) ||
    data.list.length === 0
  ) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  let episodes: string[] = [];

  // 处理播放源拆分
  if (videoDetail.vod_play_url) {
    const playSources = videoDetail.vod_play_url.split('$$$');
    if (playSources.length > 0) {
      const mainSource = playSources[0];
      const episodeList = mainSource.split('#');
      episodes = episodeList
        .map((ep: string) => {
          const parts = ep.split('$');
          return parts.length > 1 ? parts[1] : '';
        })
        .filter(
          (url: string) =>
            url && (url.startsWith('http://') || url.startsWith('https://'))
        );
    }
  }

  // 如果播放源为空，则尝试从内容中解析 m3u8
  if (episodes.length === 0 && videoDetail.vod_content) {
    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
    episodes = matches.map((link: string) => link.replace(/^\$/, ''));
  }

  return {
    id: id.toString(),
    title: videoDetail.vod_name,
    poster: videoDetail.vod_pic,
    episodes,
    source: apiSite.key,
    source_name: apiSite.name,
    class: videoDetail.vod_class,
    year: videoDetail.vod_year
      ? videoDetail.vod_year.match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(videoDetail.vod_content),
    type_name: videoDetail.type_name,
    douban_id: videoDetail.vod_douban_id,
  };
}

async function handleSpecialSourceDetail(
  id: string,
  apiSite: ApiSite
): Promise<SearchResult> {
  const detailUrl = `${apiSite.detail}/index.php/vod/detail/id/${id}.html`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (apiSite.key === 'ffzy') {
    const ffzyPattern =
      /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = html.match(ffzyPattern) || [];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = html.match(generalPattern) || [];
  }

  // 去重并清理链接前缀
  matches = Array.from(new Set(matches)).map((link: string) => {
    link = link.substring(1); // 去掉开头的 $
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  // 提取标题
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  // 提取描述
  const descMatch = html.match(
    /<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/
  );
  const descText = descMatch ? cleanHtmlTags(descMatch[1]) : '';

  // 提取封面
  const coverMatch = html.match(/(https?:\/\/[^"'\s]+?\.jpg)/g);
  const coverUrl = coverMatch ? coverMatch[0].trim() : '';

  // 提取年份
  const yearMatch = html.match(/>(\d{4})</);
  const yearText = yearMatch ? yearMatch[1] : 'unknown';

  return {
    id,
    title: titleText,
    poster: coverUrl,
    episodes: matches,
    source: apiSite.key,
    source_name: apiSite.name,
    class: '',
    year: yearText,
    desc: descText,
    type_name: '',
    douban_id: 0,
  };
}
