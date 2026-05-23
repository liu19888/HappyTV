/* eslint-disable no-console,@typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';

// 生成认证Cookie
async function generateAuthCookie(
  password: string,
  role: 'owner' | 'admin' | 'user' = 'user',
  includePassword = false
): Promise<string> {
  const authData: any = { role };

  // 只在需要时包含 password
  if (includePassword && password) {
    authData.password = password;
  }

  return encodeURIComponent(JSON.stringify(authData));
}

export async function POST(req: NextRequest) {
  try {
    const envPassword = process.env.PASSWORD;

    // 未配置 PASSWORD 时直接放行
    if (!envPassword) {
      const response = NextResponse.json({ ok: true });

      // 清除可能存在的认证cookie
      response.cookies.set('auth', '', {
        path: '/',
        expires: new Date(0),
        sameSite: 'lax',
        httpOnly: false,
        secure: false,
      });

      return response;
    }

    const { password } = await req.json();
    if (typeof password !== 'string') {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    if (password !== envPassword) {
      return NextResponse.json(
        { ok: false, error: '密码错误' },
        { status: 401 }
      );
    }

    // 验证成功，设置认证cookie
    const response = NextResponse.json({ ok: true });
    const cookieValue = await generateAuthCookie(password, 'owner', true);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7天过期

    response.cookies.set('auth', cookieValue, {
      path: '/',
      expires,
      sameSite: 'lax',
      httpOnly: false,
      secure: false,
    });

    return response;
  } catch (error) {
    console.error('登录接口异常', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
