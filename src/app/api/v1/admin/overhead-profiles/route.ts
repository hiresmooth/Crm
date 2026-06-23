export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditRates, requireAuth, ForbiddenError } from '@/lib/permissions';

const patchSchema = z.object({
  id: z.string().uuid(),
  overhead_pct: z.number().min(0).max(1).optional(),
  name: z.string().optional(),
});

export async function GET() {
  requireAuth(await getSession());
  const profiles = await prisma.overheadProfile.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return apiSuccess(profiles);
}

export async function PATCH(request: Request) {
  try {
    const session = requireAuth(await getSession());
    if (!canEditRates(session)) throw new ForbiddenError('Admin access required');

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

    const { id, ...fields } = parsed.data;
    const profile = await prisma.overheadProfile.update({
      where: { id },
      data: {
        ...(fields.overhead_pct !== undefined ? { overheadPct: fields.overhead_pct } : {}),
        ...(fields.name ? { name: fields.name } : {}),
      },
    });
    return apiSuccess(profile);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
