/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';

export const runtime = 'edge';

export async function GET() {
  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://bgm.tv/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const filteredData = Array.isArray(data)
      ? data.map((item) => ({
          ...item,
          items: Array.isArray(item?.items)
            ? item.items.filter((bangumiItem: { images?: unknown }) => !!bangumiItem?.images)
            : [],
        }))
      : [];

    const cacheTime = await getCacheTime();
    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取 Bangumi 日历数据失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
