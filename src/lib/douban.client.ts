import { DoubanItem, DoubanResult } from './types';
import { getDoubanProxyConfig } from './utils';

interface DoubanCategoriesParams {
  kind: 'tv' | 'movie';
  category: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

interface DoubanCategoryApiResponse {
  total: number;
  items: Array<{
    id: string;
    title: string;
    card_subtitle: string;
    pic: {
      large: string;
      normal: string;
    };
    rating: {
      value: number;
    };
  }>;
}

/**
 * 带超时的 fetch 请求（接收完整 URL，不内部处理代理）
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Referer: 'https://movie.douban.com/',
      Accept: 'application/json, text/plain, */*',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 检查是否应该使用客户端获取豆瓣数据
 */
export function shouldUseDoubanClient(): boolean {
  const { proxyType } = getDoubanProxyConfig();
  return proxyType !== 'direct';
}

/**
 * 浏览器端豆瓣分类数据获取函数
 * @param params 查询参数
 * @param corsProxyUrl CORS代理URL前缀（用于 cors-proxy-zwei / cors-anywhere / custom）
 * @param useTencentCDN 是否使用腾讯云CDN域名替换
 * @param useAliCDN 是否使用阿里云CDN域名替换
 */
export async function fetchDoubanCategories(
  params: DoubanCategoriesParams,
  corsProxyUrl = '',
  useTencentCDN = false,
  useAliCDN = false
): Promise<DoubanResult> {
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;

  // 验证参数
  if (!['tv', 'movie'].includes(kind)) {
    throw new Error('kind 参数必须是 tv 或 movie');
  }

  if (!category || !type) {
    throw new Error('category 和 type 参数不能为空');
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  // 基础域名选择
  let baseUrl = 'https://m.douban.com';
  if (useTencentCDN) {
    baseUrl = 'https://m.douban.cmliussss.net';
  } else if (useAliCDN) {
    baseUrl = 'https://m.douban.cmliussss.com';
  }

  const targetPath = `/rexxar/api/v2/subject/recent_hot/${kind}?start=${pageStart}&limit=${pageLimit}&category=${category}&type=${type}`;
  const targetUrl = `${baseUrl}${targetPath}`;
  const finalUrl = corsProxyUrl ? `${corsProxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl;

  try {
    const response = await fetchWithTimeout(finalUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    // 转换数据格式
    const list: DoubanItem[] = doubanData.items.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    // 触发全局错误提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣分类数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一的豆瓣分类数据获取函数，根据代理类型选择使用服务端 API 或客户端代理获取
 */
export async function getDoubanCategories(
  params: DoubanCategoriesParams
): Promise<DoubanResult> {
  const { proxyType, proxyUrl } = getDoubanProxyConfig();

  switch (proxyType) {
    case 'cors-proxy-zwei':
      return fetchDoubanCategories(params, 'https://ciao-cors.is-an.org/');
    case 'cmliussss-cdn-tencent':
      return fetchDoubanCategories(params, '', true, false);
    case 'cmliussss-cdn-ali':
      return fetchDoubanCategories(params, '', false, true);
    case 'cors-anywhere':
      return fetchDoubanCategories(params, 'https://cors-anywhere.com/');
    case 'custom':
      if (proxyUrl) {
        return fetchDoubanCategories(params, proxyUrl);
      }
      // custom 但没填URL，fallback 到服务端
      break;
    case 'direct':
    default:
      break;
  }

  // 直连 或 fallback：使用服务端 API
  const { kind, category, type, pageLimit = 20, pageStart = 0 } = params;
  const response = await fetch(
    `/api/douban/categories?kind=${kind}&category=${category}&type=${type}&limit=${pageLimit}&start=${pageStart}`
  );

  if (!response.ok) {
    // 触发全局错误提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣分类数据失败' },
        })
      );
    }
    throw new Error('获取豆瓣分类数据失败');
  }

  return response.json();
}

interface DoubanListParams {
  tag: string;
  type: string;
  pageLimit?: number;
  pageStart?: number;
}

/**
 * 浏览器端豆瓣列表数据获取函数
 * @param params 查询参数
 * @param corsProxyUrl CORS代理URL前缀
 * @param useTencentCDN 是否使用腾讯云CDN域名替换
 * @param useAliCDN 是否使用阿里云CDN域名替换
 */
export async function fetchDoubanList(
  params: DoubanListParams,
  corsProxyUrl = '',
  useTencentCDN = false,
  useAliCDN = false
): Promise<DoubanResult> {
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;

  // 验证参数
  if (!tag || !type) {
    throw new Error('tag 和 type 参数不能为空');
  }

  if (!['tv', 'movie'].includes(type)) {
    throw new Error('type 参数必须是 tv 或 movie');
  }

  if (pageLimit < 1 || pageLimit > 100) {
    throw new Error('pageLimit 必须在 1-100 之间');
  }

  if (pageStart < 0) {
    throw new Error('pageStart 不能小于 0');
  }

  // 基础域名选择
  let baseUrl = 'https://movie.douban.com';
  if (useTencentCDN) {
    baseUrl = 'https://movie.douban.cmliussss.net';
  } else if (useAliCDN) {
    baseUrl = 'https://movie.douban.cmliussss.com';
  }

  const targetPath = `/j/search_subjects?type=${type}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
  const targetUrl = `${baseUrl}${targetPath}`;
  const finalUrl = corsProxyUrl ? `${corsProxyUrl}${encodeURIComponent(targetUrl)}` : targetUrl;

  try {
    const response = await fetchWithTimeout(finalUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const doubanData: DoubanCategoryApiResponse = await response.json();

    // 转换数据格式
    const list: DoubanItem[] = doubanData.items.map((item) => ({
      id: item.id,
      title: item.title,
      poster: item.pic?.normal || item.pic?.large || '',
      rate: item.rating?.value ? item.rating.value.toFixed(1) : '',
      year: item.card_subtitle?.match(/(\d{4})/)?.[1] || '',
    }));

    return {
      code: 200,
      message: '获取成功',
      list: list,
    };
  } catch (error) {
    // 触发全局错误提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣列表数据失败' },
        })
      );
    }
    throw new Error(`获取豆瓣分类数据失败: ${(error as Error).message}`);
  }
}

/**
 * 统一的豆瓣列表数据获取函数，根据代理类型选择使用服务端 API 或客户端代理获取
 */
export async function getDoubanList(
  params: DoubanListParams
): Promise<DoubanResult> {
  const { proxyType, proxyUrl } = getDoubanProxyConfig();

  switch (proxyType) {
    case 'cors-proxy-zwei':
      return fetchDoubanList(params, 'https://ciao-cors.is-an.org/');
    case 'cmliussss-cdn-tencent':
      return fetchDoubanList(params, '', true, false);
    case 'cmliussss-cdn-ali':
      return fetchDoubanList(params, '', false, true);
    case 'cors-anywhere':
      return fetchDoubanList(params, 'https://cors-anywhere.com/');
    case 'custom':
      if (proxyUrl) {
        return fetchDoubanList(params, proxyUrl);
      }
      // custom 但没填URL，fallback 到服务端
      break;
    case 'direct':
    default:
      break;
  }

  // 直连 或 fallback：使用服务端 API
  const { tag, type, pageLimit = 20, pageStart = 0 } = params;
  const response = await fetch(
    `/api/douban?tag=${tag}&type=${type}&pageSize=${pageLimit}&pageStart=${pageStart}`
  );

  if (!response.ok) {
    // 触发全局错误提示
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('globalError', {
          detail: { message: '获取豆瓣列表数据失败' },
        })
      );
    }
    throw new Error('获取豆瓣列表数据失败');
  }

  return response.json();
}
