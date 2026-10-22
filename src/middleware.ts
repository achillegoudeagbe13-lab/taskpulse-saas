import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les routes API gèrent elles-mêmes leur authentification (requireAuth /
  // requireOrgMember) avec des réponses JSON 401/403 : le middleware ne doit
  // jamais rediriger une requête /api vers /login.
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get('taskpulse-session');
  const hasSession = !!cookie?.value;

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
