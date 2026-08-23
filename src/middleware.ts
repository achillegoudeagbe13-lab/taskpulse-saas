import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ['/', '/login', '/register-org'];
  const isPublic = publicRoutes.some((r) => pathname === r);
  const isApi = pathname.startsWith('/api');

  if (isPublic || isApi) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('taskpulse-session');
  const hasSession = !!cookie?.value;

  if (pathname.startsWith('/platform')) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/o/')) {
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/platform/:path*', '/o/:path*'],
};
