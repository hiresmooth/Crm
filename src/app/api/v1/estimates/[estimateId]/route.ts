export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess, nextNumber } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import {
  buildLineInputs,
  lineItemsCreateData,
  rollupFields,
} from '@/lib/estimate-service';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z.object({
  estimate_name: z.string().min(1).optional(),
  access_difficulty: z.enum(['standard', 'moderate', 'difficult', 'extreme']).optional(),
  job_conditions: z.array(z.string()).optional(),
  is_rush: z.boolean().optional(),
  is_repeat_layout: z.boolean().optional(),
  repeat_unit_count: z.number().int().optional(),
  margin_target_pct: z.number().min(0.1).max(0.6).optional(),
  notes_internal: z.string().optional(),
  notes_client: z.string().optional(),
  valid_until: z.string().optional(),
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
  })).min(1).optional(),
  create_revision: z.boolean().default(false),
});

export async function GET(
  _request: Request,
  { params }: { params: { estimateId: string } }
) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: {
      lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      lead: { include: { client: true } },
      marginProfile: true,
      overheadProfile: true,
      estimator: { select: { firstName: true, lastName: true, email: true } },
      proposals: true,
      marginOverrides: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
  return apiSuccess(estimate);
}

export async function PATCH(
  request: Request,
  { params }: { params: { estimateId: string } }
) {
  const session = requireAuth(await getSession());
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.errors.map((e) => ({
      code: 'VALIDATION_ERROR',
      field: e.path.join('.'),
      message: e.message,
    })));
  }

  const existing = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: { lineItems: true },
  });
  if (!existing) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);

  const editable = ['draft', 'revision_requested'];
  if (parsed.data.create_revision) {
    if (existing.status !== 'approved') {
      return apiError([{ code: 'INVALID_STATUS', message: 'Can only revise approved estimates' }], 422);
    }
    await prisma.estimate.update({
      where: { id: existing.id },
      data: { status: 'superseded' },
    });
  } else if (!editable.includes(existing.status)) {
    return apiError([{ code: 'INVALID_STATUS', message: `Cannot edit estimate in ${existing.status} status` }], 422);
  }

  const lineItems = parsed.data.line_items ?? existing.lineItems.map((l) => ({
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
  }));

  const calcPayload = {
    access_difficulty: parsed.data.access_difficulty ?? existing.accessDifficulty,
    job_conditions: parsed.data.job_conditions ?? existing.jobConditions,
    is_rush: parsed.data.is_rush ?? existing.isRush,
    is_repeat_layout: parsed.data.is_repeat_layout ?? existing.isRepeatLayout,
    repeat_unit_count: parsed.data.repeat_unit_count ?? existing.repeatUnitCount ?? undefined,
    margin_target_pct: parsed.data.margin_target_pct ?? Number(existing.marginTargetPct),
    margin_profile_id: existing.marginProfileId,
    overhead_profile_id: existing.overheadProfileId,
    project: { zip: existing.projectZip ?? '02118' },
    line_items: lineItems,
  };

  const { lineInputs, line_outputs, rollup, rates } = await buildLineInputs(calcPayload as never);

  if (parsed.data.create_revision) {
    const count = await prisma.estimate.count();
    const created = await prisma.estimate.create({
      data: {
        estimateNumber: nextNumber('E', count + 1),
        leadId: existing.leadId,
        clientId: existing.clientId,
        version: existing.version + 1,
        parentEstimateId: existing.id,
        status: 'draft',
        estimateName: parsed.data.estimate_name ?? existing.estimateName,
        serviceType: existing.serviceType,
        projectType: existing.projectType,
        projectStreet: existing.projectStreet,
        projectCity: existing.projectCity,
        projectState: existing.projectState,
        projectZip: existing.projectZip,
        accessDifficulty: calcPayload.access_difficulty as never,
        jobConditions: calcPayload.job_conditions as never[],
        isRush: calcPayload.is_rush,
        isRepeatLayout: calcPayload.is_repeat_layout,
        repeatUnitCount: calcPayload.repeat_unit_count,
        marginTargetPct: calcPayload.margin_target_pct,
        marginProfileId: existing.marginProfileId,
        overheadProfileId: existing.overheadProfileId,
        estimatorUserId: session.id,
        validUntil: parsed.data.valid_until ? new Date(parsed.data.valid_until) : existing.validUntil,
        notesInternal: parsed.data.notes_internal ?? existing.notesInternal,
        notesClient: parsed.data.notes_client ?? existing.notesClient,
        ...rollupFields(rollup),
        lineItems: { create: lineItemsCreateData(calcPayload as never, lineInputs, line_outputs, rates) },
      },
      include: { lineItems: true },
    });

    await emitEvent({
      eventType: 'estimate_created',
      leadId: created.leadId,
      estimateId: created.id,
      userId: session.id,
      payload: { revision_of: existing.id, version: created.version },
    });

    return apiSuccess({ estimate_id: created.id, estimate_number: created.estimateNumber, status: created.status, rollup });
  }

  await prisma.estimateLineItem.deleteMany({ where: { estimateId: existing.id } });
  const updated = await prisma.estimate.update({
    where: { id: existing.id },
    data: {
      estimateName: parsed.data.estimate_name ?? existing.estimateName,
      accessDifficulty: calcPayload.access_difficulty as never,
      jobConditions: calcPayload.job_conditions as never[],
      isRush: calcPayload.is_rush,
      isRepeatLayout: calcPayload.is_repeat_layout,
      repeatUnitCount: calcPayload.repeat_unit_count,
      marginTargetPct: calcPayload.margin_target_pct,
      notesInternal: parsed.data.notes_internal ?? existing.notesInternal,
      notesClient: parsed.data.notes_client ?? existing.notesClient,
      validUntil: parsed.data.valid_until ? new Date(parsed.data.valid_until) : existing.validUntil,
      status: existing.status === 'revision_requested' ? 'draft' : existing.status,
      ...rollupFields(rollup),
      lineItems: { create: lineItemsCreateData(calcPayload as never, lineInputs, line_outputs, rates) },
    },
    include: { lineItems: true },
  });

  await emitEvent({
    eventType: 'estimate_updated',
    leadId: updated.leadId,
    estimateId: updated.id,
    userId: session.id,
    payload: { estimate_number: updated.estimateNumber },
  });

  return apiSuccess({ estimate_id: updated.id, status: updated.status, rollup });
}
