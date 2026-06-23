import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/proposals/view',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/v1/public',
  '/api/cron',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('smoothos_session')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, errors: [{ code: 'UNAUTHORIZED', message: 'Login required' }] }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, errors: [{ code: 'UNAUTHORIZED', message: 'Invalid session' }] }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
