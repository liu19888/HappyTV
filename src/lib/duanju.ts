/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { API_CONFIG, getConfig } from '@/lib/config';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';
import { yellowWords } from '@/lib/yellow';

const CACHE_TTL = 60 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

interface CmsClassItem {
  type_id: string | number;
  type_name: string;
}

interface CmsClassResponse {
  class?: CmsClassItem[];
}

interface CmsVideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic?: string;
  vod_remarks?: string;
  vod_year?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

interface CmsVideoResponse {
  list?: CmsVideoItem[];
  total?: number;
  page?: number;
  pagecount?: number;
}

export interface DuanjuCategory {
  type_id: string;
  type_name: string;
}

export interface DuanjuSource {
  key: string;
  name: string;
  api: string;
  categories: DuanjuCategory[];
}

export interface DuanjuVideoList {
  list: SearchResult[];
  total: number;
  page: number;
  pagecount: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.data as T;
}

function setCache<T>(key: string, data: T) {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

function buildCmsUrl(api: string, params: Record<string, string | number>) {
  const url = new URL(api);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isYellowTypeName(typeName: string) {
  return yellowWords.some((word: string) => typeName.includes(word));
}

function normalizeCategories(categories: CmsClassItem[] = []): DuanjuCategory[] {
  return categories
    .filter((item) => isDuanjuTypeName(item.type_name || ''))
    .map((item) => ({
      type_id: String(item.type_id),
      type_name: item.type_name,
    }));
}

function parseEpisodes(item: CmsVideoItem) {
  let episodes: string[] = [];
  let episodesTitles: string[] = [];

  if (!item.vod_play_url) {
    return { episodes, episodesTitles };
  }

  item.vod_play_url.split('$$$').forEach((playUrl) => {
    const currentEpisodes: string[] = [];
    const currentTitles: string[] = [];

    playUrl.split('#').forEach((episode) => {
      const separatorIndex = episode.indexOf('$');
      if (separatorIndex === -1) return;

      const title = episode.slice(0, separatorIndex).trim();
      const url = episode.slice(separatorIndex + 1).trim();
      if (!title || !url) return;

      currentTitles.push(title);
      currentEpisodes.push(url);
    });

    if (currentEpisodes.length > episodes.length) {
      episodes = currentEpisodes;
      episodesTitles = currentTitles;
    }
  });

  return { episodes, episodesTitles };
}

function mapVideoItem(item: CmsVideoItem, source: DuanjuSource): SearchResult {
  const { episodes, episodesTitles } = parseEpisodes(item);
  const yearMatch = item.vod_year?.match(/\d{4}/)?.[0];

  return {
    id: String(item.vod_id),
    title: (item.vod_name || '').trim().replace(/\s+/g, ' '),
    poster: item.vod_pic || '',
    episodes,
    episodes_titles: episodesTitles,
    source: source.key,
    source_name: source.name,
    class: item.vod_class,
    year: yearMatch || item.vod_year || 'unknown',
    desc: cleanHtmlTags(item.vod_content || ''),
    type_name: item.type_name,
    douban_id: item.vod_douban_id,
    vod_remarks: item.vod_remarks,
  };
}

export function isDuanjuTypeName(typeName: string): boolean {
  const normalizedTypeName = typeName.toLowerCase();
  return (
    normalizedTypeName.includes('短剧') ||
    normalizedTypeName.includes('微短剧') ||
    normalizedTypeName.includes('短视频')
  );
}

export async function getDuanjuSources(): Promise<DuanjuSource[]> {
  const cached = getCache<DuanjuSource[]>('duanju:sources');
  if (cached) return cached;

  const config = await getConfig();
  const sources = config.SourceConfig.filter((source) => !source.disabled);

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        const data = await fetchJson<CmsClassResponse>(
          buildCmsUrl(source.api, { ac: 'list' }),
          5000
        );
        const categories = normalizeCategories(data.class);
        if (categories.length === 0) return null;

        return {
          key: source.key,
          name: source.name,
          api: source.api,
          categories,
        };
      } catch (error) {
        console.error(`检查短剧源 ${source.name} 失败:`, error);
        return null;
      }
    })
  );

  const duanjuSources = results.filter(
    (source): source is DuanjuSource => source !== null
  );

  const wwzyIndex = duanjuSources.findIndex((source) => source.key === 'wwzy');
  if (wwzyIndex > 0) {
    const [wwzy] = duanjuSources.splice(wwzyIndex, 1);
    duanjuSources.unshift(wwzy);
  }

  setCache('duanju:sources', duanjuSources);
  return duanjuSources;
}

export async function getDuanjuCategories(
  sourceKey: string
): Promise<DuanjuCategory[]> {
  const cached = getCache<DuanjuCategory[]>(`duanju:categories:${sourceKey}`);
  if (cached) return cached;

  const config = await getConfig();
  const sources = await getDuanjuSources();
  const source = sources.find((item) => item.key === sourceKey);
  if (!source) return [];

  const data = await fetchJson<CmsClassResponse>(
    buildCmsUrl(source.api, { ac: 'list' }),
    10000
  );

  let categories = normalizeCategories(data.class);
  if (!config.SiteConfig.DisableYellowFilter) {
    categories = categories.filter((item) => !isYellowTypeName(item.type_name));
  }

  setCache(`duanju:categories:${sourceKey}`, categories);
  return categories;
}

export async function getDuanjuVideos(
  sourceKey: string,
  typeId: string,
  page: number
): Promise<DuanjuVideoList> {
  const sources = await getDuanjuSources();
  const source = sources.find((item) => item.key === sourceKey);
  if (!source) {
    throw new Error(`未找到短剧采集源: ${sourceKey}`);
  }

  const currentPage = Math.max(1, page || 1);
  const data = await fetchJson<CmsVideoResponse>(
    buildCmsUrl(source.api, {
      ac: 'videolist',
      t: typeId,
      pg: currentPage,
    }),
    10000
  );

  const list = (data.list || [])
    .map((item) => mapVideoItem(item, source))
    .filter((item) => item.episodes.length > 0);

  return {
    list,
    total: data.total || 0,
    page: data.page || currentPage,
    pagecount: data.pagecount || (list.length > 0 ? currentPage + 1 : currentPage),
  };
}

export async function getDuanjuRecommends(): Promise<SearchResult[]> {
  const cached = getCache<SearchResult[]>('duanju:recommends');
  if (cached) return cached;

  const sources = await getDuanjuSources();
  const source = sources.find((item) => item.key === 'wwzy') || sources[0];
  const typeId = source?.categories[0]?.type_id;
  if (!source || !typeId) return [];

  const result = await getDuanjuVideos(source.key, typeId, 1);
  const recommends = result.list.slice(0, 20);
  setCache('duanju:recommends', recommends);
  return recommends;
}
