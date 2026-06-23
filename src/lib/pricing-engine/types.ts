export type ServiceCode =
  | 'closed_cell_foam'
  | 'open_cell_foam'
  | 'attic_insulation'
  | 'basement_insulation'
  | 'crawl_space_insulation'
  | 'blow_in_insulation'
  | 'air_sealing'
  | 'drywall'
  | 'plastering'
  | 'window_replacement';

export type QuantityType =
  | 'sq_ft'
  | 'board_ft'
  | 'linear_ft'
  | 'each'
  | 'cubic_ft'
  | 'bag';

export type AccessDifficulty = 'standard' | 'moderate' | 'difficult' | 'extreme';

export type MarginStatus = 'green' | 'yellow' | 'red' | 'min_job_adjusted';

export type DrywallFinishLevel =
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'level_4'
  | 'level_5';

export type PlasterSystem =
  | 'veneer'
  | 'traditional_3_coat'
  | 'skim_coat'
  | 'repair_patch';

export type WindowSizeTier = 'small' | 'medium' | 'large' | 'picture';

export type BlowInLocation = 'wall_cavity' | 'open_attic' | 'closed_cavity';

export type FlashingComplexity = 'standard' | 'historic' | 'masonry';

export interface PricingModifier {
  multiplier: number;
  applies_to: 'labor' | 'material' | 'direct';
}

export interface MarginProfileInput {
  green_min_pct: number;
  yellow_min_pct: number;
  min_job_charge: number;
  small_job_threshold: number;
  small_job_fee: number;
  rush_multiplier: number;
  rush_material_surcharge_pct: number;
  repeat_layout_discount_pct: number;
  repeat_layout_min_units: number;
  high_value_threshold: number;
  access_multipliers: Record<AccessDifficulty, number>;
  rounding_increment: number;
}

export interface OverheadProfileInput {
  overhead_pct: number;
}

export interface LineItemInput {
  service_code: ServiceCode;
  quantity_type: QuantityType;
  quantity_raw: number;
  thickness_inches?: number;
  r_value_target?: number;
  product: {
    unit_cost: number;
    unit: QuantityType;
    default_waste_pct: number;
    r_value_per_inch?: number;
    coverage_per_unit?: number;
  };
  waste_pct: number;
  production_rate: { units_per_hour: number; unit: QuantityType };
  labor_rate: { burdened_rate_hr: number };
  equipment_rate?: {
    charge_type: string;
    rate_amount: number;
    allocation_pct?: number;
  };
  modifiers: PricingModifier[];
  access_difficulty: AccessDifficulty;
  access_multipliers: Record<AccessDifficulty, number>;
  is_rush: boolean;
  rush_multiplier: number;
  rush_material_surcharge_pct: number;
  is_repeat_layout: boolean;
  repeat_layout_discount_pct: number;
  repeat_layout_min_units: number;
  repeat_unit_count?: number;
  job_conditions?: string[];
  drywall_finish_level?: DrywallFinishLevel;
  plaster_system?: PlasterSystem;
  window_size_tier?: WindowSizeTier;
  window_count?: number;
  penetration_count?: number;
  duct_seal_count?: number;
  linear_ft_top_plate?: number;
  blower_door_target?: boolean;
  blow_in_location?: BlowInLocation;
  flashing_complexity?: FlashingComplexity;
  interior_trim_included?: boolean;
  sides_count?: number;
  insulate_floor?: boolean;
  insulate_walls?: boolean;
  vapor_barrier?: boolean;
  crawl_wall_height_inches?: number;
  perimeter_lf?: number;
  cavity_height_inches?: number;
  product_unit_cost_floor?: number;
  basement_product_mode?: 'foam' | 'batt';
}

export interface LineItemOutput {
  quantity_normalized: number;
  quantity_waste_adjusted: number;
  material_cost: number;
  labor_hours: number;
  labor_cost: number;
  equipment_cost: number;
  line_direct_cost: number;
  calculation_detail: Record<string, number | string | boolean>;
}

export interface EstimateRollupInput {
  line_outputs: LineItemOutput[];
  margin_target_pct: number;
  margin_profile: MarginProfileInput;
  overhead_profile: OverheadProfileInput;
  project_zip?: string;
  shop_zip?: string;
  has_spray_foam: boolean;
  preliminary_sell_before_fees?: number;
}

export interface EstimateRollupOutput {
  line_direct_total: number;
  mobilization_cost: number;
  small_job_fee: number;
  direct_cost_total: number;
  overhead_cost: number;
  cost_before_profit: number;
  sell_price: number;
  rounded_price: number;
  gross_margin_pct: number;
  margin_status: MarginStatus;
  approval_required: boolean;
  min_job_adjusted: boolean;
}

export class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ValidationError';
  }
}
