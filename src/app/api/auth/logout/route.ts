import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, data: { logged_out: true } });
  res.cookies.set(clearSessionCookie());
  return res;
}
