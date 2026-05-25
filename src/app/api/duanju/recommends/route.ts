/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDuanjuRecommends } from '@/lib/duanju';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const recommends = await getDuanjuRecommends();
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: recommends,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取热播短剧推荐失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取热播短剧推荐失败',
        data: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
