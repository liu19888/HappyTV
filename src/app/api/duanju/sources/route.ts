/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDuanjuSources } from '@/lib/duanju';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sources = await getDuanjuSources();
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      { code: 200, message: '获取成功', data: sources },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取短剧视频源失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取短剧视频源失败',
        data: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
