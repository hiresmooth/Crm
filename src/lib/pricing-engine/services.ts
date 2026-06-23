import type { LineItemInput, LineItemOutput } from './types';
import {
  applyAccessAndRush,
  applyRepeatLayoutDiscount,
  buildLineOutput,
  materialWithRushSurcharge,
  normalizeQuantity,
  round2,
  round4,
  wasteAdjustedQty,
} from './shared';

function foamCalculator(
  input: LineItemInput,
  rigAllocation: number,
  defaultWaste: number
): LineItemOutput {
  const Q = normalizeQuantity(input);
  const waste = input.waste_pct ?? defaultWaste;
  const Q_waste = wasteAdjustedQty(Q, waste);
  let material_cost = Q_waste * input.product.unit_cost;
  material_cost = materialWithRushSurcharge(material_cost, input);

  const labor_hours_base = Q / input.production_rate.units_per_hour;
  let labor_hours = applyAccessAndRush(labor_hours_base, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;

  const equipment_cost =
    (input.equipment_rate?.rate_amount ?? 450) * (input.equipment_rate?.allocation_pct ?? rigAllocation);

  return buildLineOutput(input, {
    quantity_normalized: round2(Q),
    quantity_waste_adjusted: round2(Q_waste),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: {
      service: input.service_code,
      Q,
      Q_waste,
      waste_pct: waste,
    },
  });
}

export function calculateClosedCellFoam(input: LineItemInput): LineItemOutput {
  return foamCalculator(input, 0.35, 0.08);
}

export function calculateOpenCellFoam(input: LineItemInput): LineItemOutput {
  return foamCalculator(input, 0.3, 0.1);
}

export function calculateAtticInsulation(input: LineItemInput): LineItemOutput {
  const Q = input.quantity_raw;
  const depth =
    input.thickness_inches ??
    (input.r_value_target
      ? Math.ceil((input.r_value_target / (input.product.r_value_per_inch ?? 3.7)) * 10) / 10
      : 13.2);
  const waste = input.waste_pct ?? 0.05;
  const Q_waste = wasteAdjustedQty(Q, waste);

  let material_cost: number;
  if (input.product.unit === 'bag' && input.product.coverage_per_unit) {
    const bags = Math.ceil(Q_waste / input.product.coverage_per_unit);
    material_cost = bags * input.product.unit_cost;
  } else {
    material_cost = Q_waste * input.product.unit_cost;
  }
  material_cost = materialWithRushSurcharge(material_cost, input);

  const labor_hours_base = Q / input.production_rate.units_per_hour;
  let labor_hours = applyAccessAndRush(labor_hours_base, input);
  labor_hours = applyRepeatLayoutDiscount(labor_hours, input, true);
  if (input.job_conditions?.includes('occupied')) labor_hours *= 1.05;

  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = (input.equipment_rate?.rate_amount ?? 175) * 0.25;

  return buildLineOutput(input, {
    quantity_normalized: round2(Q),
    quantity_waste_adjusted: round2(Q_waste),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'attic_insulation', depth_inches: depth, Q, Q_waste },
  });
}

export function calculateBasementInsulation(input: LineItemInput): LineItemOutput {
  const wall_sf = input.quantity_raw;
  const mode = input.basement_product_mode ?? 'foam';
  const t = input.thickness_inches ?? 2;

  let material_cost: number;
  let labor_hours_base: number;

  if (mode === 'foam') {
    const Q = wall_sf * (t / 12);
    const Q_waste = wasteAdjustedQty(Q, input.waste_pct ?? 0.08);
    material_cost = Q_waste * input.product.unit_cost;
    labor_hours_base = wall_sf / input.production_rate.units_per_hour;
  } else {
    const Q_waste = wasteAdjustedQty(wall_sf, input.waste_pct ?? 0.03);
    material_cost = Q_waste * input.product.unit_cost;
    labor_hours_base = wall_sf / 200;
  }

  material_cost = materialWithRushSurcharge(material_cost, input);
  const labor_hours = applyAccessAndRush(labor_hours_base, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost =
    mode === 'foam' ? (input.equipment_rate?.rate_amount ?? 450) * 0.4 : 0;

  return buildLineOutput(input, {
    quantity_normalized: round2(wall_sf),
    quantity_waste_adjusted: round2(wall_sf),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'basement_insulation', mode, wall_sf },
  });
}

export function calculateCrawlSpaceInsulation(input: LineItemInput): LineItemOutput {
  const floor_sf = input.quantity_raw;
  const perimeter = input.perimeter_lf ?? Math.sqrt(floor_sf) * 4;
  const wall_height = input.crawl_wall_height_inches ?? 24;
  const wall_sf = perimeter * (wall_height / 12);
  const t = input.thickness_inches ?? 2;

  let material_cost = 0;
  let labor_hours = 0;

  if (input.insulate_floor !== false) {
    material_cost += floor_sf * (1 + (input.waste_pct ?? 0.05)) * (input.product_unit_cost_floor ?? input.product.unit_cost);
    labor_hours += (floor_sf / 120) * (input.access_multipliers[input.access_difficulty] ?? 1);
  }

  if (input.insulate_walls) {
    const Q_bf = wall_sf * (t / 12);
    material_cost += Q_bf * (1 + 0.08) * input.product.unit_cost;
    labor_hours += (wall_sf / 70) * (input.access_multipliers[input.access_difficulty] ?? 1);
  }

  if (input.vapor_barrier) {
    material_cost += floor_sf * 1.1 * 0.45;
    labor_hours += floor_sf / 400;
  }

  labor_hours = applyAccessAndRush(labor_hours, input);
  material_cost = materialWithRushSurcharge(material_cost, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = input.insulate_walls ? (input.equipment_rate?.rate_amount ?? 450) * 0.2 : 0;

  return buildLineOutput(input, {
    quantity_normalized: round2(floor_sf),
    quantity_waste_adjusted: round2(floor_sf),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'crawl_space_insulation', floor_sf, wall_sf },
  });
}

export function calculateBlowInInsulation(input: LineItemInput): LineItemOutput {
  const Q = input.quantity_raw;
  const location = input.blow_in_location ?? 'open_attic';
  const waste = input.waste_pct ?? (location === 'wall_cavity' ? 0.07 : 0.05);
  const Q_waste = wasteAdjustedQty(Q, waste);

  const production =
    location === 'wall_cavity' ? 180 : location === 'open_attic' ? 900 : 250;

  const material_cost = materialWithRushSurcharge(
    Q_waste * input.product.unit_cost,
    input
  );
  const labor_hours = applyAccessAndRush(Q / production, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipAlloc = location === 'open_attic' ? 0.25 : 0.4;
  const equipment_cost = (input.equipment_rate?.rate_amount ?? 175) * equipAlloc;

  return buildLineOutput(input, {
    quantity_normalized: round2(Q),
    quantity_waste_adjusted: round2(Q_waste),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'blow_in_insulation', location, Q, Q_waste },
  });
}

export function calculateAirSealing(input: LineItemInput): LineItemOutput {
  const base_sf = input.quantity_raw;
  const penetrations = input.penetration_count ?? 0;
  const ducts = input.duct_seal_count ?? 0;
  const top_plate = input.linear_ft_top_plate ?? 0;

  let labor_hours =
    base_sf / 600 + penetrations * 0.15 + ducts * 0.25 + top_plate * 0.05;
  if (input.blower_door_target) labor_hours += 2;

  if (input.job_conditions?.includes('new_construction')) labor_hours *= 0.85;
  if (input.job_conditions?.includes('occupied')) labor_hours *= 1.15;

  labor_hours = applyAccessAndRush(labor_hours, input);
  const material_cost = materialWithRushSurcharge(base_sf * 0.18 * 1.05, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = 75;

  return buildLineOutput(input, {
    quantity_normalized: round2(base_sf),
    quantity_waste_adjusted: round2(base_sf),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'air_sealing', base_sf, penetrations, ducts },
  });
}

const DRYWALL_PRODUCTION: Record<string, number> = {
  level_1: 180,
  level_2: 120,
  level_3: 85,
  level_4: 55,
  level_5: 35,
};

export function calculateDrywall(input: LineItemInput): LineItemOutput {
  const finish = input.drywall_finish_level ?? 'level_4';
  const sides = input.sides_count ?? 1;
  const hang_sf = input.quantity_raw * sides;
  const waste = input.waste_pct ?? (input.job_conditions?.includes('new_construction') ? 0.12 : 0.15);
  const Q_waste = wasteAdjustedQty(hang_sf, waste);

  const material_cost = materialWithRushSurcharge(
    Q_waste * input.product.unit_cost,
    input
  );
  let labor_hours = applyAccessAndRush(
    hang_sf / (DRYWALL_PRODUCTION[finish] ?? 55),
    input
  );
  labor_hours = applyRepeatLayoutDiscount(labor_hours, input, true);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = hang_sf > 1200 ? 150 : 0;

  return buildLineOutput(input, {
    quantity_normalized: round2(hang_sf),
    quantity_waste_adjusted: round2(Q_waste),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'drywall', finish, hang_sf },
  });
}

const PLASTER_MATERIAL: Record<string, number> = {
  veneer: 1.85,
  traditional_3_coat: 3.4,
  skim_coat: 1.2,
  repair_patch: 2.5,
};

const PLASTER_PRODUCTION: Record<string, number> = {
  veneer: 45,
  traditional_3_coat: 22,
  skim_coat: 90,
  repair_patch: 35,
};

export function calculatePlastering(input: LineItemInput): LineItemOutput {
  const system = input.plaster_system ?? 'veneer';
  const Q = input.quantity_raw;
  const Q_waste = wasteAdjustedQty(Q, input.waste_pct ?? 0.05);

  const material_cost = materialWithRushSurcharge(
    Q_waste * (PLASTER_MATERIAL[system] ?? 1.85),
    input
  );
  const labor_hours = applyAccessAndRush(
    Q / (PLASTER_PRODUCTION[system] ?? 45),
    input
  );
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = Q > 800 ? 125 : 0;

  return buildLineOutput(input, {
    quantity_normalized: round2(Q),
    quantity_waste_adjusted: round2(Q_waste),
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'plastering', system, Q },
  });
}

const WINDOW_MATERIAL: Record<string, number> = {
  small: 285,
  medium: 425,
  large: 620,
  picture: 950,
};

const WINDOW_LABOR: Record<string, number> = {
  small: 2.5,
  medium: 3.5,
  large: 5.0,
  picture: 8.0,
};

const FLASHING_MULT: Record<string, number> = {
  standard: 1.0,
  historic: 1.35,
  masonry: 1.25,
};

export function calculateWindowReplacement(input: LineItemInput): LineItemOutput {
  const tier = input.window_size_tier ?? 'medium';
  const count = input.quantity_raw;
  const flashing = input.flashing_complexity ?? 'standard';
  const flashMult = FLASHING_MULT[flashing] ?? 1;

  let material_cost = count * (WINDOW_MATERIAL[tier] ?? 425) * 1.02;
  let labor_hours = count * (WINDOW_LABOR[tier] ?? 3.5) * flashMult;

  if (input.interior_trim_included) {
    material_cost += count * 45;
    labor_hours += count * 1;
  }

  labor_hours = applyAccessAndRush(labor_hours, input);
  material_cost = materialWithRushSurcharge(material_cost, input);
  const labor_cost = labor_hours * input.labor_rate.burdened_rate_hr;
  const equipment_cost = count >= 3 ? 0 : 150;

  return buildLineOutput(input, {
    quantity_normalized: count,
    quantity_waste_adjusted: count,
    material_cost,
    labor_hours: round4(labor_hours),
    labor_cost,
    equipment_cost,
    calculation_detail: { service: 'window_replacement', tier, count, flashing },
  });
}
