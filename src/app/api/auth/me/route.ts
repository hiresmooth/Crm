import { getSession } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return apiError([{ code: 'UNAUTHORIZED', message: 'Not logged in' }], 401);
  return apiSuccess({ user: session });
}
