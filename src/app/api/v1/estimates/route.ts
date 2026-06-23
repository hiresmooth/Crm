import { z } from 'zod';
import type { Prisma, ServiceCode, QuantityType } from '@prisma/client';
import { calculateEstimate } from '@/lib/pricing-engine';
import { apiError, apiSuccess, nextNumber } from '@/lib/api';
import { emitEvent } from '@/lib/events';
import { buildLineItemInput, loadRateContext, marginProfileToInput } from '@/lib/estimate-calc';
import { prisma } from '@/lib/prisma';

const lineItemSchema = z.object({
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
});

const estimateSchema = z.object({
  lead_id: z.string().uuid(),
  estimate_name: z.string().min(1),
  service_type: z.string(),
  project_type: z.enum(['residential', 'multifamily', 'commercial', 'municipal']).default('residential'),
  project: z.object({
    street: z.string().optional(),
    city: z.string(),
    state: z.string().default('MA'),
    zip: z.string().optional(),
  }),
  access_difficulty: z.enum(['standard', 'moderate', 'difficult', 'extreme']).default('standard'),
  job_conditions: z.array(z.string()).default([]),
  is_rush: z.boolean().default(false),
  is_repeat_layout: z.boolean().default(false),
  repeat_unit_count: z.number().int().optional(),
  margin_target_pct: z.number().min(0.1).max(0.6).default(0.35),
  margin_profile_id: z.string().uuid().optional(),
  overhead_profile_id: z.string().uuid().optional(),
  valid_until: z.string().optional(),
  notes_internal: z.string().optional(),
  notes_client: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1),
  estimator_user_id: z.string().uuid().optional(),
});

export async function GET() {
  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      lead: { include: { client: true } },
      lineItems: true,
      estimator: { select: { firstName: true, lastName: true } },
    },
  });
  return apiSuccess(estimates);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = estimateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors.map((e) => ({
        code: 'VALIDATION_ERROR',
        field: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  const data = parsed.data;
  const lead = await prisma.lead.findUnique({ where: { id: data.lead_id }, include: { client: true } });
  if (!lead) return apiError([{ code: 'NOT_FOUND', message: 'Lead not found' }], 404);
  if (lead.stage === 'lost') return apiError([{ code: 'INVALID_STATE', message: 'Cannot estimate lost lead' }], 409);

  const rates = await loadRateContext(prisma);
  const marginProfile = data.margin_profile_id
    ? await prisma.marginProfile.findUniqueOrThrow({ where: { id: data.margin_profile_id } })
    : rates.marginProfile;
  const overheadProfile = data.overhead_profile_id
    ? await prisma.overheadProfile.findUniqueOrThrow({ where: { id: data.overhead_profile_id } })
    : rates.overheadProfile;

  const estimator = data.estimator_user_id
    ? await prisma.user.findUnique({ where: { id: data.estimator_user_id } })
    : await prisma.user.findFirst({ where: { role: 'estimator', isActive: true } });

  if (!estimator) return apiError([{ code: 'NO_ESTIMATOR', message: 'No estimator available' }], 422);

  const lineInputs = [];
  for (const line of data.line_items) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: line.product_id } });
    const productionRate = line.production_rate_id
      ? await prisma.productionRate.findUniqueOrThrow({ where: { id: line.production_rate_id } })
      : await prisma.productionRate.findFirstOrThrow({
          where: { serviceCode: line.service_code as never, active: true },
        });
    const laborRate = line.labor_rate_id
      ? await prisma.laborRate.findUniqueOrThrow({ where: { id: line.labor_rate_id } })
      : await prisma.laborRate.findFirstOrThrow({ where: { active: true } });
    const equipmentRate = line.equipment_rate_id
      ? await prisma.equipmentRate.findUnique({ where: { id: line.equipment_rate_id } })
      : null;

    lineInputs.push(
      buildLineItemInput({
        serviceCode: line.service_code as never,
        quantityType: line.quantity_type,
        quantityRaw: line.quantity_raw,
        thicknessInches: line.thickness_inches,
        rValueTarget: line.r_value_target,
        wastePct: line.waste_pct ?? Number(product.defaultWastePct),
        product,
        productionRate,
        laborRate,
        equipmentRate,
        accessDifficulty: data.access_difficulty,
        marginProfile,
        isRush: data.is_rush,
        isRepeatLayout: data.is_repeat_layout,
        repeatUnitCount: data.repeat_unit_count,
        jobConditions: data.job_conditions as never[],
        drywallFinishLevel: line.drywall_finish_level as never,
        plasterSystem: line.plaster_system as never,
        windowSizeTier: line.window_size_tier as never,
        penetrationCount: line.penetration_count,
        ductSealCount: line.duct_seal_count,
      })
    );
  }

  const { line_outputs, rollup } = calculateEstimate({
    lines: lineInputs,
    margin_target_pct: data.margin_target_pct,
    margin_profile: marginProfileToInput(marginProfile),
    overhead_pct: Number(overheadProfile.overheadPct),
    project_zip: data.project.zip ?? lead.projectZip ?? '02118',
  });

  const count = await prisma.estimate.count();
  const estimateNumber = nextNumber('E', count + 1);
  const validUntil = data.valid_until
    ? new Date(data.valid_until)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      leadId: lead.id,
      clientId: lead.clientId,
      estimateName: data.estimate_name,
      serviceType: data.service_type as never,
      projectType: data.project_type,
      projectStreet: data.project.street ?? lead.projectStreet,
      projectCity: data.project.city,
      projectState: data.project.state,
      projectZip: data.project.zip ?? lead.projectZip,
      accessDifficulty: data.access_difficulty,
      jobConditions: data.job_conditions as never[],
      isRush: data.is_rush,
      isRepeatLayout: data.is_repeat_layout,
      repeatUnitCount: data.repeat_unit_count,
      marginTargetPct: data.margin_target_pct,
      marginProfileId: marginProfile.id,
      overheadProfileId: overheadProfile.id,
      estimatorUserId: estimator.id,
      validUntil,
      notesInternal: data.notes_internal,
      notesClient: data.notes_client,
      directCostTotal: rollup.direct_cost_total,
      mobilizationCost: rollup.mobilization_cost,
      smallJobFee: rollup.small_job_fee,
      overheadCost: rollup.overhead_cost,
      costBeforeProfit: rollup.cost_before_profit,
      sellPrice: rollup.sell_price,
      roundedPrice: rollup.rounded_price,
      grossMarginPct: rollup.gross_margin_pct,
      marginStatus: rollup.margin_status,
      approvalRequired: rollup.approval_required,
      minJobAdjusted: rollup.min_job_adjusted,
      calculationSnapshot: rollup as object,
      lineItems: {
        create: data.line_items.map((line, i) => {
          const prodRateId =
            line.production_rate_id ??
            rates.productionRates.find((p) => p.serviceCode === line.service_code)?.id;
          if (!prodRateId) throw new Error(`No production rate for ${line.service_code}`);
          return {
            sortOrder: line.sort_order ?? i + 1,
            serviceCode: line.service_code as ServiceCode,
            assemblyName: line.assembly_name,
            areaName: line.area_name,
            quantityType: line.quantity_type as QuantityType,
            quantityRaw: line.quantity_raw,
            quantityNormalized: line_outputs[i].quantity_normalized,
            thicknessInches: line.thickness_inches,
            rValueTarget: line.r_value_target,
            productId: line.product_id,
            wastePct: line.waste_pct ?? Number(line_outputs[i].calculation_detail.waste_pct ?? 0.05),
            productionRateId: prodRateId,
            laborRateId: line.labor_rate_id ?? rates.laborRates[0].id,
            equipmentRateId: line.equipment_rate_id ?? undefined,
            modifierIds: [] as string[],
            drywallFinishLevel: line.drywall_finish_level as Prisma.EstimateLineItemUncheckedCreateWithoutEstimateInput['drywallFinishLevel'],
            plasterSystem: line.plaster_system as Prisma.EstimateLineItemUncheckedCreateWithoutEstimateInput['plasterSystem'],
            windowSizeTier: line.window_size_tier as Prisma.EstimateLineItemUncheckedCreateWithoutEstimateInput['windowSizeTier'],
            materialCost: line_outputs[i].material_cost,
            laborHours: line_outputs[i].labor_hours,
            laborCost: line_outputs[i].labor_cost,
            equipmentCost: line_outputs[i].equipment_cost,
            lineDirectCost: line_outputs[i].line_direct_cost,
            calculationDetail: line_outputs[i].calculation_detail as object,
          } satisfies Prisma.EstimateLineItemUncheckedCreateWithoutEstimateInput;
        }),
      },
    },
    include: { lineItems: true, lead: true },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: 'estimate_in_progress', estimatedValue: rollup.rounded_price },
  });

  await emitEvent({
    eventType: 'estimate_created',
    leadId: lead.id,
    estimateId: estimate.id,
    userId: estimator.id,
    payload: { estimate_number: estimateNumber, rounded_price: rollup.rounded_price },
    crmPayload: {
      estimate_id: estimate.id,
      estimate_number: estimateNumber,
      lead_id: lead.id,
      status: estimate.status,
      rounded_price: rollup.rounded_price,
      gross_margin_pct: rollup.gross_margin_pct,
      service_type: data.service_type,
      line_item_count: data.line_items.length,
    },
  });

  return apiSuccess(
    {
      estimate_id: estimate.id,
      estimate_number: estimate.estimateNumber,
      status: estimate.status,
      rollup,
      line_items: estimate.lineItems,
    },
    201
  );
}
