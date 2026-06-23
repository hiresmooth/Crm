export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { getSession } from '@/lib/auth';
import { canEditRates } from '@/lib/permissions';
import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string(),
  name: z.string(),
  service_code: z.string(),
  unit: z.string(),
  unit_cost: z.number().positive(),
  default_waste_pct: z.number().min(0).max(0.5),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!canEditRates(session)) return apiError([{ code: 'FORBIDDEN', message: 'Admin only' }], 403);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const d = parsed.data;
  const product = d.id
    ? await prisma.product.update({
        where: { id: d.id },
        data: {
          sku: d.sku,
          name: d.name,
          serviceCode: d.service_code as never,
          unit: d.unit as never,
          unitCost: d.unit_cost,
          defaultWastePct: d.default_waste_pct,
        },
      })
    : await prisma.product.create({
        data: {
          sku: d.sku,
          name: d.name,
          serviceCode: d.service_code as never,
          unit: d.unit as never,
          unitCost: d.unit_cost,
          defaultWastePct: d.default_waste_pct,
          active: true,
        },
      });

  return apiSuccess(product, d.id ? 200 : 201);
}
