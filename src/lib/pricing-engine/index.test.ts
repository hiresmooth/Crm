import { describe, expect, it } from 'vitest';
import {
  calculateEstimate,
  calculateLineItem,
  DEFAULT_MARGIN_PROFILE,
  type LineItemInput,
} from './index';

const baseInput = (): Partial<LineItemInput> => ({
  quantity_type: 'sq_ft',
  waste_pct: 0.05,
  production_rate: { units_per_hour: 900, unit: 'sq_ft' },
  labor_rate: { burdened_rate_hr: 68 },
  modifiers: [],
  access_difficulty: 'standard',
  access_multipliers: DEFAULT_MARGIN_PROFILE.access_multipliers,
  is_rush: false,
  rush_multiplier: 1.15,
  rush_material_surcharge_pct: 0.05,
  is_repeat_layout: false,
  repeat_layout_discount_pct: 0.12,
  repeat_layout_min_units: 4,
});

describe('pricing engine', () => {
  it('calculates attic blow-in line item', () => {
    const input: LineItemInput = {
      ...baseInput(),
      service_code: 'attic_insulation',
      quantity_raw: 1120,
      r_value_target: 49,
      thickness_inches: 13.2,
      product: {
        unit_cost: 0.42,
        unit: 'sq_ft',
        default_waste_pct: 0.05,
        r_value_per_inch: 3.7,
      },
    } as LineItemInput;

    const result = calculateLineItem(input);
    expect(result.quantity_normalized).toBe(1120);
    expect(result.material_cost).toBeGreaterThan(0);
    expect(result.labor_hours).toBeGreaterThan(0);
    expect(result.line_direct_cost).toBeGreaterThan(0);
  });

  it('calculates closed cell foam from sq_ft and thickness', () => {
    const input: LineItemInput = {
      ...baseInput(),
      service_code: 'closed_cell_foam',
      quantity_raw: 400,
      thickness_inches: 2,
      waste_pct: 0.08,
      production_rate: { units_per_hour: 120, unit: 'board_ft' },
      product: { unit_cost: 1.45, unit: 'board_ft', default_waste_pct: 0.08 },
      equipment_rate: { charge_type: 'per_job_allocation', rate_amount: 450, allocation_pct: 0.35 },
    } as LineItemInput;

    const result = calculateLineItem(input);
    expect(result.quantity_normalized).toBeCloseTo(400 * (2 / 12), 1);
    expect(result.line_direct_cost).toBeGreaterThan(100);
  });

  it('rolls up estimate with mobilization and margin', () => {
    const line: LineItemInput = {
      ...baseInput(),
      service_code: 'attic_insulation',
      quantity_raw: 1120,
      r_value_target: 49,
      thickness_inches: 13.2,
      product: {
        unit_cost: 0.42,
        unit: 'sq_ft',
        default_waste_pct: 0.05,
        r_value_per_inch: 3.7,
      },
    } as LineItemInput;

    const { rollup } = calculateEstimate({
      lines: [line],
      margin_target_pct: 0.35,
      project_zip: '02143',
    });

    expect(rollup.mobilization_cost).toBe(350);
    expect(rollup.rounded_price).toBeGreaterThanOrEqual(850);
    expect(rollup.rounded_price % 5).toBe(0);
    expect(rollup.gross_margin_pct).toBeGreaterThan(0);
    expect(['green', 'yellow', 'red', 'min_job_adjusted']).toContain(rollup.margin_status);
  });

  it('flags yellow/red margin when target is low', () => {
    const line: LineItemInput = {
      ...baseInput(),
      service_code: 'air_sealing',
      quantity_raw: 200,
      penetration_count: 5,
      product: { unit_cost: 0.18, unit: 'sq_ft', default_waste_pct: 0.05 },
      production_rate: { units_per_hour: 600, unit: 'sq_ft' },
    } as LineItemInput;

    const { rollup } = calculateEstimate({
      lines: [line],
      margin_target_pct: 0.1,
      project_zip: '02118',
    });

    expect(rollup.approval_required).toBe(true);
  });

  it('calculates window replacement per unit', () => {
    const input: LineItemInput = {
      ...baseInput(),
      service_code: 'window_replacement',
      quantity_type: 'each',
      quantity_raw: 3,
      window_size_tier: 'medium',
      product: { unit_cost: 425, unit: 'each', default_waste_pct: 0.02 },
      production_rate: { units_per_hour: 1, unit: 'each' },
      labor_rate: { burdened_rate_hr: 72 },
    } as LineItemInput;

    const result = calculateLineItem(input);
    expect(result.quantity_normalized).toBe(3);
    expect(result.equipment_cost).toBe(0);
    expect(result.line_direct_cost).toBeGreaterThan(1000);
  });
});
