export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { buildLineInputs } from '@/lib/estimate-service';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  access_difficulty: z.enum(['standard', 'moderate', 'difficult', 'extreme']).optional(),
  job_conditions: z.array(z.string()).optional(),
  is_rush: z.boolean().optional(),
  is_repeat_layout: z.boolean().optional(),
  repeat_unit_count: z.number().int().optional(),
  margin_target_pct: z.number().min(0.1).max(0.6).optional(),
  margin_profile_id: z.string().uuid().optional(),
  overhead_profile_id: z.string().uuid().optional(),
  project: z.object({ zip: z.string().optional() }).optional(),
  line_items: z.array(z.object({
    service_code: z.string(),
    assembly_name: z.string(),
    area_name: z.string().optional(),
    quantity_type: z.string(),
    quantity_raw: z.number().positive(),
    thickness_inches: z.number().optional(),
    r_value_target: z.number().int().optional(),
    product_id: z.string().uuid(),
    waste_pct: z.number().optional(),
    production_rate_id: z.string().uuid().optional(),
    labor_rate_id: z.string().uuid().optional(),
    equipment_rate_id: z.string().uuid().optional().nullable(),
    drywall_finish_level: z.string().optional(),
    plaster_system: z.string().optional(),
    window_size_tier: z.string().optional(),
    penetration_count: z.number().optional(),
    duct_seal_count: z.number().optional(),
    sort_order: z.number().int(),
  })).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: { estimateId: string } }
) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: { lineItems: true },
  });
  if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const payload = parsed.success ? parsed.data : {
    access_difficulty: estimate.accessDifficulty,
    job_conditions: estimate.jobConditions,
    is_rush: estimate.isRush,
    is_repeat_layout: estimate.isRepeatLayout,
    repeat_unit_count: estimate.repeatUnitCount ?? undefined,
    margin_target_pct: Number(estimate.marginTargetPct),
    margin_profile_id: estimate.marginProfileId,
    overhead_profile_id: estimate.overheadProfileId,
    project: { zip: estimate.projectZip ?? '02118' },
    line_items: estimate.lineItems.map((l) => ({
      service_code: l.serviceCode,
      assembly_name: l.assemblyName,
      area_name: l.areaName ?? undefined,
      quantity_type: l.quantityType,
      quantity_raw: Number(l.quantityRaw),
      thickness_inches: l.thicknessInches ? Number(l.thicknessInches) : undefined,
      r_value_target: l.rValueTarget ?? undefined,
      product_id: l.productId,
      waste_pct: Number(l.wastePct),
      production_rate_id: l.productionRateId,
      labor_rate_id: l.laborRateId,
      equipment_rate_id: l.equipmentRateId,
      sort_order: l.sortOrder,
    })),
  };

  const { line_outputs, rollup } = await buildLineInputs(payload as never);

  return apiSuccess({
    estimate_id: estimate.id,
    rollup,
    line_items: line_outputs,
    margin_status: rollup.margin_status,
    approval_required: rollup.approval_required,
  });
}
