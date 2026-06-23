import { NextResponse } from 'next/server';
import { runAlertEngine } from '@/lib/alerts/engine';

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runAlertEngine();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
