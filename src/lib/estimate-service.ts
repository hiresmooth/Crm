import type { Prisma } from '@prisma/client';
import { calculateEstimate } from '@/lib/pricing-engine';
import { buildLineItemInput, loadRateContext, marginProfileToInput } from '@/lib/estimate-calc';
import { prisma } from '@/lib/prisma';

export const lineItemSchema = {
  service_code: '',
  assembly_name: '',
  area_name: '',
  quantity_type: '',
  quantity_raw: 0,
  thickness_inches: 0,
  r_value_target: 0,
  product_id: '',
  waste_pct: 0,
  production_rate_id: '',
  labor_rate_id: '',
  equipment_rate_id: '',
  drywall_finish_level: '',
  plaster_system: '',
  window_size_tier: '',
  penetration_count: 0,
  duct_seal_count: 0,
  sort_order: 0,
};

export type LineItemPayload = {
  service_code: string;
  assembly_name: string;
  area_name?: string;
  quantity_type: string;
  quantity_raw: number;
  thickness_inches?: number;
  r_value_target?: number;
  product_id: string;
  waste_pct?: number;
  production_rate_id?: string;
  labor_rate_id?: string;
  equipment_rate_id?: string | null;
  drywall_finish_level?: string;
  plaster_system?: string;
  window_size_tier?: string;
  penetration_count?: number;
  duct_seal_count?: number;
  sort_order: number;
};

export type EstimateInputPayload = {
  access_difficulty: 'standard' | 'moderate' | 'difficult' | 'extreme';
  job_conditions: string[];
  is_rush: boolean;
  is_repeat_layout: boolean;
  repeat_unit_count?: number;
  margin_target_pct: number;
  margin_profile_id?: string;
  overhead_profile_id?: string;
  project: { zip?: string };
  line_items: LineItemPayload[];
};

export async function buildLineInputs(data: EstimateInputPayload) {
  const rates = await loadRateContext(prisma);
  const marginProfile = data.margin_profile_id
    ? await prisma.marginProfile.findUniqueOrThrow({ where: { id: data.margin_profile_id } })
    : rates.marginProfile;
  const overheadProfile = data.overhead_profile_id
    ? await prisma.overheadProfile.findUniqueOrThrow({ where: { id: data.overhead_profile_id } })
    : rates.overheadProfile;

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

    lineInputs.push({
      input: buildLineItemInput({
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
      }),
      line,
      product,
      productionRate,
      laborRate,
      rates,
    });
  }

  const { line_outputs, rollup } = calculateEstimate({
    lines: lineInputs.map((l) => l.input),
    margin_target_pct: data.margin_target_pct,
    margin_profile: marginProfileToInput(marginProfile),
    overhead_pct: Number(overheadProfile.overheadPct),
    project_zip: data.project.zip ?? '02118',
  });

  return { lineInputs, line_outputs, rollup, marginProfile, overheadProfile, rates };
}

export function lineItemsCreateData(
  data: EstimateInputPayload,
  lineInputs: Awaited<ReturnType<typeof buildLineInputs>>['lineInputs'],
  line_outputs: Awaited<ReturnType<typeof buildLineInputs>>['line_outputs'],
  rates: Awaited<ReturnType<typeof buildLineInputs>>['rates']
): Prisma.EstimateLineItemUncheckedCreateWithoutEstimateInput[] {
  return data.line_items.map((line, i) => {
    const prodRateId =
      line.production_rate_id ??
      rates.productionRates.find((p) => p.serviceCode === line.service_code)?.id;
    if (!prodRateId) throw new Error(`No production rate for ${line.service_code}`);
    return {
      sortOrder: line.sort_order ?? i + 1,
      serviceCode: line.service_code as never,
      assemblyName: line.assembly_name,
      areaName: line.area_name,
      quantityType: line.quantity_type as never,
      quantityRaw: line.quantity_raw,
      quantityNormalized: line_outputs[i].quantity_normalized,
      thicknessInches: line.thickness_inches,
      rValueTarget: line.r_value_target,
      productId: line.product_id,
      wastePct: line.waste_pct ?? Number(line_outputs[i].calculation_detail?.waste_pct ?? 0.05),
      productionRateId: prodRateId,
      laborRateId: line.labor_rate_id ?? rates.laborRates[0].id,
      equipmentRateId: line.equipment_rate_id ?? undefined,
      modifierIds: [] as string[],
      drywallFinishLevel: line.drywall_finish_level as never,
      plasterSystem: line.plaster_system as never,
      windowSizeTier: line.window_size_tier as never,
      materialCost: line_outputs[i].material_cost,
      laborHours: line_outputs[i].labor_hours,
      laborCost: line_outputs[i].labor_cost,
      equipmentCost: line_outputs[i].equipment_cost,
      lineDirectCost: line_outputs[i].line_direct_cost,
      calculationDetail: line_outputs[i].calculation_detail as object,
    };
  });
}

export function rollupFields(rollup: Awaited<ReturnType<typeof buildLineInputs>>['rollup']) {
  return {
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
  };
}

export async function canSendProposalForEstimate(estimateId: string): Promise<{ ok: boolean; reason?: string }> {
  const estimate = await prisma.estimate.findUnique({ where: { id: estimateId } });
  if (!estimate) return { ok: false, reason: 'Estimate not found' };
  if (estimate.status !== 'approved') return { ok: false, reason: 'Estimate must be approved' };
  return { ok: true };
}
