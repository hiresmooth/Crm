export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { getAlerts } from '@/lib/alerts/engine';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const mineOnly = searchParams.get('assigned_to_me') === 'true';
  const unreadOnly = searchParams.get('unread_only') === 'true';

  const alerts = await getAlerts({
    assignedUserId: mineOnly && session ? session.id : undefined,
    unreadOnly,
  });

  return apiSuccess({ alerts });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { prisma } = await import('@/lib/prisma');
  if (body.dismiss && body.id) {
    await prisma.alert.update({ where: { id: body.id }, data: { isDismissed: true, resolvedAt: new Date() } });
  }
  if (body.read && body.id) {
    await prisma.alert.update({ where: { id: body.id }, data: { isRead: true } });
  }
  return apiSuccess({ ok: true });
}
