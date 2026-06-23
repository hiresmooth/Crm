import type { LineItemInput, LineItemOutput, ServiceCode } from './types';
import { ValidationError } from './types';
import {
  calculateAirSealing,
  calculateAtticInsulation,
  calculateBasementInsulation,
  calculateBlowInInsulation,
  calculateClosedCellFoam,
  calculateCrawlSpaceInsulation,
  calculateDrywall,
  calculateOpenCellFoam,
  calculatePlastering,
  calculateWindowReplacement,
} from './services';
import {
  calculateMobilization,
  DEFAULT_MARGIN_PROFILE,
  rollupEstimate,
} from './shared';
import type { EstimateRollupInput, EstimateRollupOutput, MarginProfileInput } from './types';

const SPRAY_SERVICES = new Set<ServiceCode>(['closed_cell_foam', 'open_cell_foam']);

type CalculatorFn = (input: LineItemInput) => LineItemOutput;

const CALCULATORS: Record<ServiceCode, CalculatorFn> = {
  closed_cell_foam: calculateClosedCellFoam,
  open_cell_foam: calculateOpenCellFoam,
  attic_insulation: calculateAtticInsulation,
  basement_insulation: calculateBasementInsulation,
  crawl_space_insulation: calculateCrawlSpaceInsulation,
  blow_in_insulation: calculateBlowInInsulation,
  air_sealing: calculateAirSealing,
  drywall: calculateDrywall,
  plastering: calculatePlastering,
  window_replacement: calculateWindowReplacement,
};

export function validateLineItemInput(input: LineItemInput): void {
  if (input.quantity_raw <= 0) {
    throw new ValidationError('INVALID_QUANTITY', 'quantity_raw must be positive');
  }

  const foamServices = ['closed_cell_foam', 'open_cell_foam'];
  if (
    foamServices.includes(input.service_code) &&
    input.quantity_type === 'sq_ft' &&
    !input.thickness_inches
  ) {
    throw new ValidationError('THICKNESS_REQUIRED', 'thickness_inches required for foam sq_ft');
  }

  if (
    ['attic_insulation', 'blow_in_insulation'].includes(input.service_code) &&
    !input.thickness_inches &&
    !input.r_value_target
  ) {
    throw new ValidationError('DEPTH_OR_R_REQUIRED', 'thickness or R-value required');
  }

  if (input.service_code === 'drywall' && !input.drywall_finish_level) {
    throw new ValidationError('FINISH_LEVEL_REQUIRED', 'drywall_finish_level required');
  }

  if (input.service_code === 'window_replacement' && !input.window_size_tier) {
    throw new ValidationError('WINDOW_TIER_REQUIRED', 'window_size_tier required');
  }
}

export function calculateLineItem(input: LineItemInput): LineItemOutput {
  validateLineItemInput(input);
  const calculator = CALCULATORS[input.service_code];
  if (!calculator) {
    throw new ValidationError('UNKNOWN_SERVICE', `Unknown service: ${input.service_code}`);
  }
  return calculator(input);
}

export function calculateEstimate(input: {
  lines: LineItemInput[];
  margin_target_pct: number;
  margin_profile?: MarginProfileInput;
  overhead_pct?: number;
  project_zip?: string;
  shop_zip?: string;
}): {
  line_outputs: LineItemOutput[];
  rollup: EstimateRollupOutput;
} {
  const margin_profile = input.margin_profile ?? DEFAULT_MARGIN_PROFILE;
  const overhead_pct = input.overhead_pct ?? 0.18;

  const line_outputs = input.lines.map(calculateLineItem);
  const has_spray = input.lines.some((l) => SPRAY_SERVICES.has(l.service_code));
  const mobilization_cost = calculateMobilization(
    input.project_zip ?? '02118',
    input.shop_zip ?? '02118',
    has_spray
  );

  const rollup = rollupEstimate(
    line_outputs,
    input.margin_target_pct,
    margin_profile,
    { overhead_pct },
    mobilization_cost,
    input.project_zip
  );

  return { line_outputs, rollup };
}

export * from './types';
export * from './shared';
export * from './services';
