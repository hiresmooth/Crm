# SmoothOS Estimator Formulas
## Implementation-Ready Calculation Logic

All calculations are deterministic. TypeScript reference implementation path: `packages/pricing-engine/src/`

---

## Shared Types

```typescript
interface LineItemInput {
  service_code: ServiceCode;
  quantity_type: QuantityType;
  quantity_raw: number;
  thickness_inches?: number;
  r_value_target?: number;
  product: { unit_cost: number; unit: QuantityType; default_waste_pct: number };
  waste_pct: number;
  production_rate: { units_per_hour: number; unit: QuantityType };
  labor_rate: { burdened_rate_hr: number };
  equipment_rate?: { charge_type: string; rate_amount: number; allocation_pct?: number };
  modifier_ids: string[];
  modifiers: { multiplier: number; applies_to: 'labor' | 'material' | 'direct' }[];
  access_difficulty: AccessDifficulty;
  access_multipliers: Record<AccessDifficulty, number>;
  is_rush: boolean;
  rush_multiplier: number;
  rush_material_surcharge_pct: number;
  is_repeat_layout: boolean;
  repeat_layout_discount_pct: number;
  repeat_layout_min_units: number;
  repeat_unit_count?: number;
  // Service-specific
  drywall_finish_level?: DrywallFinishLevel;
  plaster_system?: PlasterSystem;
  window_size_tier?: WindowSizeTier;
  window_count?: number;
  penetration_count?: number;
  duct_seal_count?: number;
  man_hours_override?: number; // Manager only, logged
}

interface LineItemOutput {
  quantity_normalized: number;
  quantity_waste_adjusted: number;
  material_cost: number;
  labor_hours: number;
  labor_cost: number;
  equipment_cost: number;
  line_direct_cost: number;
  calculation_detail: Record<string, number | string>;
}
```

---

## Shared Functions

```typescript
function normalizeQuantity(input: LineItemInput): number {
  const { service_code, quantity_type, quantity_raw, thickness_inches } = input;

  const BOARD_FT_SERVICES = ['closed_cell_foam', 'open_cell_foam'];
  if (BOARD_FT_SERVICES.includes(service_code) && quantity_type === 'sq_ft') {
    if (!thickness_inches || thickness_inches <= 0) {
      throw new ValidationError('thickness_inches required for foam sq_ft input');
    }
    return quantity_raw * (thickness_inches / 12);
  }
  return quantity_raw;
}

function wasteAdjustedQty(q: number, waste_pct: number): number {
  return q * (1 + waste_pct);
}

function applyAccessAndRush(
  baseHours: number,
  input: LineItemInput
): number {
  const accessMult = input.access_multipliers[input.access_difficulty] ?? 1.0;
  const rushMult = input.is_rush ? input.rush_multiplier : 1.0;
  return baseHours * accessMult * rushMult;
}

function applyRepeatLayoutDiscount(
  hours: number,
  input: LineItemInput,
  eligible: boolean
): number {
  if (!eligible || !input.is_repeat_layout) return hours;
  if ((input.repeat_unit_count ?? 0) < input.repeat_layout_min_units) return hours;
  return hours * (1 - input.repeat_layout_discount_pct);
}

function applyModifiers(
  material: number,
  labor: number,
  equipment: number,
  modifiers: LineItemInput['modifiers']
): { material: number; labor: number; equipment: number; direct: number } {
  let m = material, l = labor, e = equipment;
  for (const mod of modifiers) {
    if (mod.applies_to === 'material') m *= mod.multiplier;
    else if (mod.applies_to === 'labor') l *= mod.multiplier;
    else if (mod.applies_to === 'direct') { m *= mod.multiplier; l *= mod.multiplier; e *= mod.multiplier; }
  }
  return { material: m, labor: l, equipment: e, direct: m + l + e };
}

function materialWithRushSurcharge(
  material: number,
  input: LineItemInput
): number {
  if (!input.is_rush || input.rush_material_surcharge_pct <= 0) return material;
  return material * (1 + input.rush_material_surcharge_pct);
}
```

---

## Estimate Rollup

```typescript
function rollupEstimate(
  lines: LineItemOutput[],
  mobilization_cost: number,
  small_job_fee: number,
  overhead_pct: number,
  margin_target_pct: number,
  margin_profile: MarginProfile
): EstimateRollup {
  const line_direct_total = lines.reduce((s, l) => s + l.line_direct_cost, 0);
  let direct_cost_total = line_direct_total + mobilization_cost + small_job_fee;

  const overhead_cost = direct_cost_total * overhead_pct;
  const cost_before_profit = direct_cost_total + overhead_cost;

  let sell_price = cost_before_profit / (1 - margin_target_pct);
  let min_job_adjusted = false;

  if (sell_price < margin_profile.min_job_charge) {
    sell_price = margin_profile.min_job_charge;
    min_job_adjusted = true;
  }

  const rounded_price =
    Math.ceil(sell_price / margin_profile.rounding_increment) *
    margin_profile.rounding_increment;

  const gross_margin_pct = (rounded_price - cost_before_profit) / rounded_price;

  let margin_status: MarginStatus = 'green';
  if (min_job_adjusted) margin_status = 'min_job_adjusted';
  else if (gross_margin_pct < margin_profile.yellow_min_pct) margin_status = 'red';
  else if (gross_margin_pct < margin_profile.green_min_pct) margin_status = 'yellow';

  const approval_required =
    margin_status === 'yellow' ||
    margin_status === 'red' ||
    rounded_price >= margin_profile.high_value_threshold;

  return {
    direct_cost_total,
    overhead_cost,
    cost_before_profit,
    sell_price,
    rounded_price,
    gross_margin_pct,
    margin_status,
    min_job_adjusted,
    approval_required,
  };
}
```

---

## Service 1: Closed Cell Spray Foam

**service_code:** `closed_cell_foam`

### Required Inputs
- `quantity_type`: `sq_ft` OR `board_ft`
- `quantity_raw`: measured area or BF
- `thickness_inches`: required if `sq_ft` (typical: 2–3" walls, 1–2" rim)
- `product_id`: closed-cell product ($/BF)
- `waste_pct`: default 0.08
- `access_difficulty`
- `production_rate_id`: closed cell standard

### Formula

```
Q = normalizeQuantity()  // sq_ft × (T/12) if sq_ft

Q_waste = Q × (1 + waste_pct)

material_cost = Q_waste × product.unit_cost
  → apply rush material surcharge

labor_hours_base = Q / production_rate.units_per_hour
  // default production: 120 BF/hr, crew 2

labor_hours = applyAccessAndRush(labor_hours_base, input)
labor_cost = labor_hours × labor_rate.burdened_rate_hr

equipment_cost = equipment_rates.SPRAY_RIG_DAY.rate_amount × allocation_pct
  // default allocation_pct = 0.35 per foam line; cap 1.0 rig-day across estimate

line_direct = material_cost + labor_cost + equipment_cost
  → applyModifiers()
```

### Optional Modifiers
- `occupied` → labor × 1.08
- `winter` → labor × 1.05
- `remediation` → direct × 1.12 (requires approval)

### Example Line Item

```json
{
  "assembly_name": "Basement rim joist — closed cell 2\"",
  "service_code": "closed_cell_foam",
  "quantity_type": "linear_ft",
  "quantity_raw": 140,
  "thickness_inches": 2,
  "area_name": "Basement perimeter",
  "product_id": "CC-SF-2.0",
  "waste_pct": 0.08,
  "client_description": "Apply 2\" closed-cell spray foam to rim joist perimeter at basement ceiling line."
}
```

Note: For rim joist, `quantity_type` = `linear_ft`, convert: `Q = quantity_raw × rim_depth_ft × 2 sides` — use `quantity_raw` as LF and `thickness_inches` as depth; normalized Q = LF × (T/12) × height_factor. Default rim height 9" → factor = 0.75 SF per LF per inch of depth applied to cavity face.

**Rim joist normalized formula:**
```
cavity_height_inches = input.cavity_height_inches ?? 9
Q = quantity_raw × (cavity_height_inches / 12) × (thickness_inches / 12) / (cavity_height_inches / 12)
  = quantity_raw × (thickness_inches / 12)  // board feet along rim
```
For wall cavities: `Q = sq_ft × (T/12)`.

---

## Service 2: Open Cell Spray Foam

**service_code:** `open_cell_foam`

### Required Inputs
Same as closed cell; typical thickness 5.5–8" roofline.

### Formula
Identical structure to closed cell with different defaults:
- `default_waste_pct`: 0.10
- `production_rate.units_per_hour`: 180 BF/hr (faster install)
- `product.unit_cost`: ~$0.62/BF

```
Q = normalizeQuantity()
Q_waste = Q × (1 + waste_pct)
material_cost = Q_waste × unit_cost
labor_hours = (Q / units_per_hour) × access_mult × rush_mult
equipment_cost = SPRAY_RIG_DAY × 0.30 allocation
line_direct = material + labor + equipment → modifiers
```

---

## Service 3: Attic Insulation

**service_code:** `attic_insulation`

Supports blow-in cellulose/fiberglass OR open-cell roofline (sub-type via product).

### Required Inputs
- `quantity_type`: `sq_ft` (attic floor area)
- `quantity_raw`: attic SF
- `r_value_target`: e.g. 49 (Mass Save typical)
- `thickness_inches`: depth required to hit R-value for blow-in
- `product_id`

### Blow-In Formula

```
// Product defines coverage_per_unit (SF per bag at depth) OR $/SF at depth
depth_inches = thickness_inches ?? r_value_to_depth(product, r_value_target)
  // cellulose: ~R-3.7/in → R-49 = 13.2"

Q = quantity_raw  // SF

Q_waste = Q × (1 + waste_pct)  // default 0.05 blow-in

IF product.unit = 'sq_ft':
  material_cost = Q_waste × product.unit_cost
ELSE IF product.unit = 'bag':
  bags_needed = CEILING(Q_waste / product.coverage_per_unit)
  material_cost = bags_needed × product.unit_cost

labor_hours_base = Q / production_rate.units_per_hour
  // default: 900 SF/hr blown attic, standard access

labor_hours = applyAccessAndRush(labor_hours_base)
labor_hours = applyRepeatLayoutDiscount(labor_hours, input, true)

labor_cost = labor_hours × labor_rate.burdened_rate_hr

equipment_cost = BLOWER_DAY × 0.25 allocation

// Attic prep adder (air sealing not included unless separate line)
IF input.job_conditions.includes('occupied'):
  labor_hours ×= 1.05

line_direct = material + labor + equipment
```

### R-Value to Depth Helper

```typescript
function rValueToDepth(product: Product, r_target: number): number {
  const r_per_inch = product.r_value_per_inch ?? 3.7;
  return Math.ceil((r_target / r_per_inch) * 10) / 10;
}
```

---

## Service 4: Basement Insulation

**service_code:** `basement_insulation`

### Required Inputs
- `quantity_type`: `sq_ft` (wall area)
- `quantity_raw`: net wall SF
- `thickness_inches`: 2–3" closed cell OR batt thickness
- `product_id`

### Formula (Spray Foam Walls)

```
wall_sf = quantity_raw
Q = wall_sf × (thickness_inches / 12)  // board feet

Q_waste = Q × (1 + 0.08)
material_cost = Q_waste × unit_cost
labor_hours = (wall_sf / production_rate.units_per_hour) × access_mult × rush_mult
  // production: 85 SF/hr wall foam (not BF/hr — rate table uses SF for walls)

labor_cost = labor_hours × labor_rate
equipment_cost = SPRAY_RIG_DAY × 0.40

line_direct = material + labor + equipment
```

### Formula (Batt / Polyiso — if product.unit = sq_ft)

```
Q = wall_sf
Q_waste = Q × (1 + 0.03)
material_cost = Q_waste × unit_cost
labor_hours = (Q / 200) × access_mult  // 200 SF/hr batt install
labor_cost = labor_hours × labor_rate
equipment_cost = 0
line_direct = material + labor
```

---

## Service 5: Crawl Space Insulation

**service_code:** `crawl_space_insulation`

### Required Inputs
- `quantity_type`: `sq_ft` (floor + optionally walls)
- `assembly` flags: `insulate_floor`, `insulate_walls`, `vapor_barrier`
- `thickness_inches`
- `product_id`
- `crawl_wall_height_inches` (default 24)

### Formula

```
floor_sf = quantity_raw_floor ?? quantity_raw
wall_sf = perimeter_lf × (crawl_wall_height_inches / 12)  // if walls included

IF insulate_floor:
  floor_Q = floor_sf  // rigid board priced per SF
  floor_material = floor_sf × (1 + waste_pct) × unit_cost_floor
  floor_labor_hrs = (floor_sf / 120) × access_mult  // low clearance penalty in access_mult

IF insulate_walls:
  wall_Q_bf = wall_sf × (thickness_inches / 12)
  wall_material = wall_Q_bf × (1 + 0.08) × unit_cost_foam
  wall_labor_hrs = (wall_sf / 70) × access_mult  // crawl wall foam slower

IF vapor_barrier:
  vb_material = floor_sf × 1.10 × 0.45  // $/SF poly
  vb_labor_hrs = floor_sf / 400

material_cost = sum(floor_material, wall_material, vb_material)
labor_hours = sum(floor_labor_hrs, wall_labor_hrs, vb_labor_hrs) × rush_mult
labor_cost = labor_hours × labor_rate

equipment_cost = 0.20 × SPRAY_RIG_DAY if wall foam else 0

line_direct = material + labor + equipment
```

**Crawl access:** `access_difficulty = difficult` default for crawl <36" height (configurable on line).

---

## Service 6: Blow-In Insulation

**service_code:** `blow_in_insulation`

### Required Inputs
- `quantity_type`: `sq_ft`
- `thickness_inches` or `r_value_target`
- `product_id`: cellulose or fiberglass
- `location`: `wall_cavity` | `open_attic` | `closed_cavity`

### Formula

```
depth = thickness_inches ?? rValueToDepth(product, r_value_target)
Q = quantity_raw
Q_waste = Q × (1 + waste_pct)
  // wall cavity: 0.07, open attic: 0.05

material_cost = Q_waste × product.unit_cost  // $/SF at depth

production_sf_hr =
  location === 'wall_cavity' ? 180 :
  location === 'open_attic' ? 900 :
  250  // closed cavity drill-fill

labor_hours = (Q / production_sf_hr) × access_mult × rush_mult
labor_cost = labor_hours × labor_rate

equipment_cost = BLOWER_DAY × (location === 'open_attic' ? 0.25 : 0.40)

line_direct = material + labor + equipment
```

---

## Service 7: Air Sealing

**service_code:** `air_sealing`

### Required Inputs
- `quantity_type`: composite — primary `sq_ft` (building footprint / attic SF) + counts
- `penetration_count`: electrical/plumbing penetrations
- `linear_ft_top_plate`: optional
- `duct_seal_count`: HVAC boots
- `blower_door_target`?: optional for QA

### Formula

```
base_sf = quantity_raw
base_material = base_sf × 0.18  // $/SF avg materials (caulk, foam, gasket)
base_labor_hrs = (base_sf / 600) + (penetration_count × 0.15) + (duct_seal_count × 0.25)
  + (linear_ft_top_plate × 0.05)

IF blower_door_target:
  base_labor_hrs += 2.0  // test + remedial seal pass

material_cost = base_material × (1 + 0.05)
labor_hours = base_labor_hrs × access_mult × rush_mult
labor_cost = labor_hours × labor_rate
equipment_cost = 75  // blower door rental allocation flat

line_direct = material + labor + equipment
```

### Modifiers
- `new_construction`: production × 0.85 (easier access)
- `occupied`: production × 1.15

---

## Service 8: Drywall

**service_code:** `drywall`

### Required Inputs
- `quantity_type`: `sq_ft` (hung SF — both sides count separately if flagged)
- `quantity_raw`
- `drywall_finish_level`: level_1 through level_5
- `product_id`: sheet cost factor embedded in unit_cost per SF
- `sides_count`: 1 or 2 (default 1)

### Formula

```
hang_sf = quantity_raw × sides_count
Q_waste = hang_sf × (1 + waste_pct)
  // new_construction: 0.12, remodel: 0.15

material_cost = Q_waste × product.unit_cost  // $/SF board + compound + tape blended

// Production rates by finish level (SF/hr, hang+finish combined crew)
PRODUCTION = {
  level_1: 180,
  level_2: 120,
  level_3: 85,
  level_4: 55,
  level_5: 35
}

labor_hours = (hang_sf / PRODUCTION[finish_level]) × access_mult × rush_mult
labor_hours = applyRepeatLayoutDiscount(labor_hours, input, true)
labor_cost = labor_hours × labor_rate

equipment_cost = 0
IF hang_sf > 1200: equipment_cost += 150  // lift allocation

line_direct = material + labor + equipment
```

### Default Product Unit Costs (blended $/SF material)
| Finish | unit_cost |
|--------|-----------|
| Level 1 | $0.95 |
| Level 2 | $1.10 |
| Level 3 | $1.35 |
| Level 4 | $1.65 |
| Level 5 | $2.20 |

---

## Service 9: Plastering

**service_code:** `plastering`

### Required Inputs
- `quantity_type`: `sq_ft`
- `plaster_system`: `veneer` | `traditional_3_coat` | `skim_coat` | `repair_patch`
- `quantity_raw`
- `product_id`

### Formula

```
Q = quantity_raw
Q_waste = Q × (1 + 0.05)

material_per_sf = {
  veneer: 1.85,
  traditional_3_coat: 3.40,
  skim_coat: 1.20,
  repair_patch: 2.50
}

material_cost = Q_waste × material_per_sf[plaster_system]

production_sf_hr = {
  veneer: 45,
  traditional_3_coat: 22,
  skim_coat: 90,
  repair_patch: 35
}

labor_hours = (Q / production_sf_hr[system]) × access_mult × rush_mult
labor_cost = labor_hours × labor_rate.burdened_rate_hr  // plasterer trade: $78/hr default

equipment_cost = 0
IF Q > 800: equipment_cost = 125  // scaffold allocation

line_direct = material + labor + equipment
```

---

## Service 10: Window Replacement

**service_code:** `window_replacement`

### Required Inputs
- `quantity_type`: `each`
- `window_count` / `quantity_raw`
- `window_size_tier`: `small` | `medium` | `large` | `picture`
- `product_id`: per-tier window unit cost
- `interior_trim_included`: boolean
- `flashing_complexity`: `standard` | `historic` | `masonry`

### Formula

```
count = quantity_raw
unit_material = {
  small: 285,
  medium: 425,
  large: 620,
  picture: 950
}[window_size_tier]

unit_labor_hrs = {
  small: 2.5,
  medium: 3.5,
  large: 5.0,
  picture: 8.0
}[window_size_tier]

flashing_mult = { standard: 1.0, historic: 1.35, masonry: 1.25 }[flashing_complexity]

material_cost = count × unit_material × (1 + 0.02)  // 2% waste/failure
labor_hours = count × unit_labor_hrs × flashing_mult × access_mult × rush_mult

IF interior_trim_included:
  material_cost += count × 45
  labor_hours += count × 1.0

labor_cost = labor_hours × labor_rate  // window installer: $72/hr

equipment_cost = count >= 3 ? 0 : 150  // min trip/setup

line_direct = material + labor + equipment
```

---

## Mobilization Calculation

```typescript
function calculateMobilization(
  estimate_zip: string,
  shop_zip: string = '02118',
  equipment_lines: string[]
): number {
  const distance_miles = zipDistance(estimate_zip, shop_zip);
  const base = distance_miles > 25 ? 650 : 350;

  // Additional rig mobilization if spray foam on estimate
  const has_spray = equipment_lines.includes('SPRAY_RIG_DAY');
  return has_spray ? base + 100 : base;
}
```

---

## Small Job Fee

```typescript
function calculateSmallJobFee(
  preliminary_sell: number,
  profile: MarginProfile
): number {
  if (preliminary_sell < profile.small_job_threshold) {
    return profile.small_job_fee;
  }
  return 0;
}
```

Apply small job fee **before** overhead allocation.

---

## Equipment Allocation Cap (Estimate Level)

```typescript
function allocateEquipmentAcrossLines(
  lines: { service_code: string; equipment_code: string }[]
): Record<string, number> {
  const sprayLines = lines.filter(l => l.equipment_code === 'SPRAY_RIG_DAY');
  const totalAlloc = sprayLines.reduce((s, l) => s + (l.allocation_pct ?? 0.35), 0);
  const cap = 1.0;
  const scale = totalAlloc > cap ? cap / totalAlloc : 1.0;
  // return per-line scaled allocation
}
```

---

## Validation Rules (Per Line)

| Rule | Error |
|------|-------|
| quantity_raw <= 0 | `INVALID_QUANTITY` |
| foam + sq_ft without thickness | `THICKNESS_REQUIRED` |
| blow-in without depth or R-value | `DEPTH_OR_R_REQUIRED` |
| drywall without finish_level | `FINISH_LEVEL_REQUIRED` |
| window without size_tier | `WINDOW_TIER_REQUIRED` |
| waste_pct > 0.30 without manager | `WASTE_OVERRIDE_REQUIRED` |
| man_hours_override without manager | `UNAUTHORIZED_OVERRIDE` |

---

## Calculation Execution Order

1. Validate all line inputs
2. Compute each line → `LineItemOutput[]`
3. Sum line direct costs
4. Add mobilization (once per estimate)
5. Compute preliminary sell without small job fee
6. Add small job fee if applicable
7. Apply overhead
8. Apply margin formula → sell_price
9. Enforce min job charge
10. Round final price
11. Compute margin_status and approval_required
12. Persist `calculation_snapshot` JSON on estimate
