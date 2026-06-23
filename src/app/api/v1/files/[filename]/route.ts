export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { readStoredFile } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const buffer = await readStoredFile(params.filename);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${params.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ code: 'NOT_FOUND', message: 'File not found' }] }, { status: 404 });
  }
}
