/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime } from '@/lib/config';
import { getDuanjuVideos } from '@/lib/duanju';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const type = searchParams.get('type') || searchParams.get('categoryId');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  if (!source) {
    return NextResponse.json(
      { code: 400, message: '缺少参数: source', data: [] },
      { status: 400 }
    );
  }

  if (!type) {
    return NextResponse.json(
      { code: 400, message: '缺少参数: type', data: [] },
      { status: 400 }
    );
  }

  try {
    const result = await getDuanjuVideos(source, type, page);
    const cacheTime = await getCacheTime();

    return NextResponse.json(
      {
        code: 200,
        message: '获取成功',
        data: result.list,
        total: result.total,
        page: result.page,
        pagecount: result.pagecount,
        pageCount: result.pagecount,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    console.error('获取短剧列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: '获取短剧列表失败',
        data: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
