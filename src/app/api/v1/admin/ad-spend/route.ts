export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { getSession } from '@/lib/auth';
import { canEditRates } from '@/lib/permissions';
import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  const session = await getSession();
  if (!canEditRates(session)) return apiError([{ code: 'FORBIDDEN', message: 'Admin only' }], 403);
  const data = await prisma.marketingAdSpend.findMany({ orderBy: { periodStart: 'desc' }, take: 50 });
  return apiSuccess(data);
}

const schema = z.object({
  source: z.string(),
  amount: z.number().positive(),
  period_start: z.string(),
  period_end: z.string(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!canEditRates(session)) return apiError([{ code: 'FORBIDDEN', message: 'Admin only' }], 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const row = await prisma.marketingAdSpend.create({
    data: {
      source: parsed.data.source as never,
      amount: parsed.data.amount,
      periodStart: new Date(parsed.data.period_start),
      periodEnd: new Date(parsed.data.period_end),
      notes: parsed.data.notes,
    },
  });

  return apiSuccess(row, 201);
}
