export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { saveFile } from '@/lib/storage';
import { requireAuth } from '@/lib/permissions';

export async function POST(request: Request) {
  requireAuth(await getSession());
  const form = await request.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return apiError([{ code: 'VALIDATION_ERROR', message: 'file required' }]);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await saveFile(file.name, buffer);

  return apiSuccess({ file_url: url, file_name: file.name, mime_type: file.type }, 201);
}
