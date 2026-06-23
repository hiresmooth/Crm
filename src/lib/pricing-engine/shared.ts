import type {
  AccessDifficulty,
  LineItemInput,
  LineItemOutput,
  MarginProfileInput,
  MarginStatus,
  PricingModifier,
} from './types';

const BOARD_FT_SERVICES = new Set(['closed_cell_foam', 'open_cell_foam']);

export function normalizeQuantity(input: LineItemInput): number {
  const { service_code, quantity_type, quantity_raw, thickness_inches } = input;

  if (BOARD_FT_SERVICES.has(service_code) && quantity_type === 'sq_ft') {
    if (!thickness_inches || thickness_inches <= 0) {
      throw new Error('thickness_inches required for foam sq_ft input');
    }
    return quantity_raw * (thickness_inches / 12);
  }

  if (service_code === 'closed_cell_foam' && quantity_type === 'linear_ft') {
    const cavityHeight = input.cavity_height_inches ?? 9;
    const t = thickness_inches ?? 2;
    return quantity_raw * (cavityHeight / 12) * (t / (cavityHeight / 12));
  }

  return quantity_raw;
}

export function wasteAdjustedQty(q: number, waste_pct: number): number {
  return q * (1 + waste_pct);
}

export function applyAccessAndRush(baseHours: number, input: LineItemInput): number {
  const accessMult = input.access_multipliers[input.access_difficulty] ?? 1.0;
  const rushMult = input.is_rush ? input.rush_multiplier : 1.0;
  return baseHours * accessMult * rushMult;
}

export function applyRepeatLayoutDiscount(
  hours: number,
  input: LineItemInput,
  eligible: boolean
): number {
  if (!eligible || !input.is_repeat_layout) return hours;
  if ((input.repeat_unit_count ?? 0) < input.repeat_layout_min_units) return hours;
  return hours * (1 - input.repeat_layout_discount_pct);
}

export function applyModifiers(
  material: number,
  labor: number,
  equipment: number,
  modifiers: PricingModifier[]
): { material: number; labor: number; equipment: number; direct: number } {
  let m = material;
  let l = labor;
  let e = equipment;
  for (const mod of modifiers) {
    if (mod.applies_to === 'material') m *= mod.multiplier;
    else if (mod.applies_to === 'labor') l *= mod.multiplier;
    else if (mod.applies_to === 'direct') {
      m *= mod.multiplier;
      l *= mod.multiplier;
      e *= mod.multiplier;
    }
  }
  return { material: m, labor: l, equipment: e, direct: m + l + e };
}

export function materialWithRushSurcharge(material: number, input: LineItemInput): number {
  if (!input.is_rush || input.rush_material_surcharge_pct <= 0) return material;
  return material * (1 + input.rush_material_surcharge_pct);
}

export function rValueToDepth(r_target: number, r_per_inch = 3.7): number {
  return Math.ceil((r_target / r_per_inch) * 10) / 10;
}

export function buildLineOutput(
  input: LineItemInput,
  partial: Omit<LineItemOutput, 'line_direct_cost' | 'calculation_detail'> & {
    calculation_detail: Record<string, number | string | boolean>;
  }
): LineItemOutput {
  const modified = applyModifiers(
    partial.material_cost,
    partial.labor_cost,
    partial.equipment_cost,
    input.modifiers
  );
  return {
    ...partial,
    material_cost: round2(modified.material),
    labor_cost: round2(modified.labor),
    equipment_cost: round2(modified.equipment),
    line_direct_cost: round2(modified.direct),
    calculation_detail: {
      ...partial.calculation_detail,
      line_direct_cost: round2(modified.direct),
    },
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function zipDistanceMiles(_zip1: string, _zip2: string): number {
  // Phase 1: simplified — extended mobilization if zip prefix differs significantly
  if (_zip1.slice(0, 3) === _zip2.slice(0, 3)) return 5;
  return 30;
}

export function calculateMobilization(
  project_zip: string,
  shop_zip = '02118',
  has_spray_foam: boolean
): number {
  const distance = zipDistanceMiles(project_zip, shop_zip);
  const base = distance > 25 ? 650 : 350;
  return has_spray_foam ? base + 100 : base;
}

export function calculateSmallJobFee(
  preliminary_sell: number,
  profile: MarginProfileInput
): number {
  if (preliminary_sell < profile.small_job_threshold) {
    return profile.small_job_fee;
  }
  return 0;
}

export function computeMarginStatus(
  gross_margin_pct: number,
  min_job_adjusted: boolean,
  profile: MarginProfileInput
): MarginStatus {
  if (min_job_adjusted) return 'min_job_adjusted';
  if (gross_margin_pct < profile.yellow_min_pct) return 'red';
  if (gross_margin_pct < profile.green_min_pct) return 'yellow';
  return 'green';
}

export function rollupEstimate(
  line_outputs: LineItemOutput[],
  margin_target_pct: number,
  margin_profile: MarginProfileInput,
  overhead_profile: { overhead_pct: number },
  mobilization_cost: number,
  project_zip?: string
): import('./types').EstimateRollupOutput {
  const line_direct_total = round2(
    line_outputs.reduce((s, l) => s + l.line_direct_cost, 0)
  );

  const preliminary_direct = line_direct_total + mobilization_cost;
  const preliminary_overhead = preliminary_direct * overhead_profile.overhead_pct;
  const preliminary_cost = preliminary_direct + preliminary_overhead;
  const preliminary_sell = preliminary_cost / (1 - margin_target_pct);

  const small_job_fee = calculateSmallJobFee(preliminary_sell, margin_profile);
  const direct_cost_total = round2(line_direct_total + mobilization_cost + small_job_fee);
  const overhead_cost = round2(direct_cost_total * overhead_profile.overhead_pct);
  const cost_before_profit = round2(direct_cost_total + overhead_cost);

  let sell_price = round2(cost_before_profit / (1 - margin_target_pct));
  let min_job_adjusted = false;

  if (sell_price < margin_profile.min_job_charge) {
    sell_price = margin_profile.min_job_charge;
    min_job_adjusted = true;
  }

  const rounded_price =
    Math.ceil(sell_price / margin_profile.rounding_increment) *
    margin_profile.rounding_increment;

  const gross_margin_pct = round4(
    (rounded_price - cost_before_profit) / rounded_price
  );

  const margin_status = computeMarginStatus(
    gross_margin_pct,
    min_job_adjusted,
    margin_profile
  );

  const approval_required =
    margin_status === 'yellow' ||
    margin_status === 'red' ||
    rounded_price >= margin_profile.high_value_threshold;

  return {
    line_direct_total,
    mobilization_cost,
    small_job_fee,
    direct_cost_total,
    overhead_cost,
    cost_before_profit,
    sell_price,
    rounded_price,
    gross_margin_pct,
    margin_status,
    approval_required,
    min_job_adjusted,
  };
}

export const DEFAULT_MARGIN_PROFILE: MarginProfileInput = {
  green_min_pct: 0.35,
  yellow_min_pct: 0.28,
  min_job_charge: 850,
  small_job_threshold: 1200,
  small_job_fee: 150,
  rush_multiplier: 1.15,
  rush_material_surcharge_pct: 0.05,
  repeat_layout_discount_pct: 0.12,
  repeat_layout_min_units: 4,
  high_value_threshold: 25000,
  access_multipliers: {
    standard: 1.0,
    moderate: 1.1,
    difficult: 1.25,
    extreme: 1.45,
  },
  rounding_increment: 5,
};

export const DEFAULT_ACCESS_MULTIPLIERS: Record<AccessDifficulty, number> =
  DEFAULT_MARGIN_PROFILE.access_multipliers;
