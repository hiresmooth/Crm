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
  green_min_pct: z.number().optional(),
  yellow_min_pct: z.number().optional(),
  min_job_charge: z.number().optional(),
  high_value_threshold: z.number().optional(),
  rounding_increment: z.number().optional(),
});

export async function GET() {
  requireAuth(await getSession());
  const profiles = await prisma.marginProfile.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return apiSuccess(profiles);
}

export async function PATCH(request: Request) {
  try {
    const session = requireAuth(await getSession());
    if (!canEditRates(session)) throw new ForbiddenError('Admin access required');

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

    const { id, ...fields } = parsed.data;
    const user = await prisma.marginProfile.update({
      where: { id },
      data: {
        ...(fields.green_min_pct !== undefined ? { greenMinPct: fields.green_min_pct } : {}),
        ...(fields.yellow_min_pct !== undefined ? { yellowMinPct: fields.yellow_min_pct } : {}),
        ...(fields.min_job_charge !== undefined ? { minJobCharge: fields.min_job_charge } : {}),
        ...(fields.high_value_threshold !== undefined ? { highValueThreshold: fields.high_value_threshold } : {}),
        ...(fields.rounding_increment !== undefined ? { roundingIncrement: fields.rounding_increment } : {}),
      },
    });
    return apiSuccess(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
