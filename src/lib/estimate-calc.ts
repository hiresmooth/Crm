import type { LineItemInput, MarginProfileInput } from '@/lib/pricing-engine';
import type {
  AccessDifficulty,
  DrywallFinishLevel,
  JobCondition,
  PlasterSystem,
  ServiceCode,
  WindowSizeTier,
} from '@prisma/client';
import type { MarginProfile, OverheadProfile, Product, LaborRate, ProductionRate, EquipmentRate } from '@prisma/client';

export function marginProfileToInput(p: MarginProfile): MarginProfileInput {
  return {
    green_min_pct: Number(p.greenMinPct),
    yellow_min_pct: Number(p.yellowMinPct),
    min_job_charge: Number(p.minJobCharge),
    small_job_threshold: Number(p.smallJobThreshold),
    small_job_fee: Number(p.smallJobFee),
    rush_multiplier: Number(p.rushMultiplier),
    rush_material_surcharge_pct: Number(p.rushMaterialSurchargePct),
    repeat_layout_discount_pct: Number(p.repeatLayoutDiscountPct),
    repeat_layout_min_units: p.repeatLayoutMinUnits,
    high_value_threshold: Number(p.highValueThreshold),
    access_multipliers: p.accessMultipliers as MarginProfileInput['access_multipliers'],
    rounding_increment: Number(p.roundingIncrement),
  };
}

export function buildLineItemInput(opts: {
  serviceCode: ServiceCode;
  quantityType: string;
  quantityRaw: number;
  thicknessInches?: number | null;
  rValueTarget?: number | null;
  wastePct: number;
  product: Product;
  productionRate: ProductionRate;
  laborRate: LaborRate;
  equipmentRate?: EquipmentRate | null;
  accessDifficulty: AccessDifficulty;
  marginProfile: MarginProfile;
  isRush: boolean;
  isRepeatLayout: boolean;
  repeatUnitCount?: number | null;
  jobConditions: JobCondition[];
  drywallFinishLevel?: DrywallFinishLevel | null;
  plasterSystem?: PlasterSystem | null;
  windowSizeTier?: WindowSizeTier | null;
  penetrationCount?: number;
  ductSealCount?: number;
}): LineItemInput {
  const mp = marginProfileToInput(opts.marginProfile);
  return {
    service_code: opts.serviceCode as LineItemInput['service_code'],
    quantity_type: opts.quantityType as LineItemInput['quantity_type'],
    quantity_raw: Number(opts.quantityRaw),
    thickness_inches: opts.thicknessInches ? Number(opts.thicknessInches) : undefined,
    r_value_target: opts.rValueTarget ?? undefined,
    product: {
      unit_cost: Number(opts.product.unitCost),
      unit: opts.product.unit as LineItemInput['quantity_type'],
      default_waste_pct: Number(opts.product.defaultWastePct),
      r_value_per_inch: opts.product.rValuePerInch ? Number(opts.product.rValuePerInch) : undefined,
      coverage_per_unit: opts.product.coveragePerUnit ? Number(opts.product.coveragePerUnit) : undefined,
    },
    waste_pct: Number(opts.wastePct),
    production_rate: {
      units_per_hour: Number(opts.productionRate.unitsPerHour),
      unit: opts.productionRate.unit as LineItemInput['quantity_type'],
    },
    labor_rate: { burdened_rate_hr: Number(opts.laborRate.burdenedRateHr) },
    equipment_rate: opts.equipmentRate
      ? {
          charge_type: opts.equipmentRate.chargeType,
          rate_amount: Number(opts.equipmentRate.rateAmount),
          allocation_pct: opts.equipmentRate.allocationPct
            ? Number(opts.equipmentRate.allocationPct)
            : undefined,
        }
      : undefined,
    modifiers: [],
    access_difficulty: opts.accessDifficulty as LineItemInput['access_difficulty'],
    access_multipliers: mp.access_multipliers,
    is_rush: opts.isRush,
    rush_multiplier: mp.rush_multiplier,
    rush_material_surcharge_pct: mp.rush_material_surcharge_pct,
    is_repeat_layout: opts.isRepeatLayout,
    repeat_layout_discount_pct: mp.repeat_layout_discount_pct,
    repeat_layout_min_units: mp.repeat_layout_min_units,
    repeat_unit_count: opts.repeatUnitCount ?? undefined,
    job_conditions: opts.jobConditions,
    drywall_finish_level: opts.drywallFinishLevel ?? undefined,
    plaster_system: opts.plasterSystem ?? undefined,
    window_size_tier: opts.windowSizeTier ?? undefined,
    penetration_count: opts.penetrationCount,
    duct_seal_count: opts.ductSealCount,
  };
}

export async function loadRateContext(prisma: import('@prisma/client').PrismaClient) {
  const [marginProfile, overheadProfile, products, laborRates, productionRates, equipmentRates] =
    await Promise.all([
      prisma.marginProfile.findFirst({ where: { isDefault: true, active: true } }),
      prisma.overheadProfile.findFirst({ where: { isDefault: true, active: true } }),
      prisma.product.findMany({ where: { active: true } }),
      prisma.laborRate.findMany({ where: { active: true } }),
      prisma.productionRate.findMany({ where: { active: true } }),
      prisma.equipmentRate.findMany({ where: { active: true } }),
    ]);

  if (!marginProfile || !overheadProfile) {
    throw new Error('Default margin/overhead profiles not seeded');
  }

  return { marginProfile, overheadProfile, products, laborRates, productionRates, equipmentRates };
}
