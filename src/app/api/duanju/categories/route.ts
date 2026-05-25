/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDuanjuCategories } from '@/lib/duanju';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return NextResponse.json(
      { code: 400, message: '缺少参数: source', data: [] },
      { status: 400 }
    );
  }

  try {
    const categories = await getDuanjuCategories(source);
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: categories,
        defaultCategory: categories[0] || null,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取短剧分类失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取短剧分类失败',
        data: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
