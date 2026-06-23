# SmoothOS Database Schema
## Implementation-Ready PostgreSQL Schema

**Database:** PostgreSQL 15+  
**ORM:** Prisma (see `prisma/schema.prisma`)  
**Naming:** snake_case columns, UUID primary keys

---

## Enums

```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'estimator', 'sales', 'office');

CREATE TYPE lead_source AS ENUM (
  'google_business', 'website_organic', 'google_ads', 'direct_call',
  'referral', 'facebook_instagram', 'chatbot', 'repeat_client', 'other'
);

CREATE TYPE lead_stage AS ENUM (
  'new_lead', 'contacted', 'estimate_in_progress', 'proposal_sent',
  'follow_up_needed', 'won', 'lost'
);

CREATE TYPE project_type AS ENUM ('residential', 'multifamily', 'commercial', 'municipal');

CREATE TYPE service_code AS ENUM (
  'closed_cell_foam', 'open_cell_foam', 'attic_insulation', 'basement_insulation',
  'crawl_space_insulation', 'blow_in_insulation', 'air_sealing',
  'drywall', 'plastering', 'window_replacement'
);

CREATE TYPE quantity_type AS ENUM (
  'sq_ft', 'board_ft', 'linear_ft', 'each', 'cubic_ft', 'bag'
);

CREATE TYPE access_difficulty AS ENUM ('standard', 'moderate', 'difficult', 'extreme');

CREATE TYPE job_condition AS ENUM (
  'occupied', 'new_construction', 'remediation', 'winter', 'hazmat_adjacent'
);

CREATE TYPE estimate_status AS ENUM (
  'draft', 'in_review', 'approved', 'revision_requested', 'superseded', 'archived'
);

CREATE TYPE margin_status AS ENUM ('green', 'yellow', 'red', 'min_job_adjusted');

CREATE TYPE proposal_status AS ENUM (
  'draft', 'internal_review', 'internal_approved', 'sent', 'viewed',
  'client_approved', 'client_declined', 'expired', 'superseded'
);

CREATE TYPE job_status AS ENUM (
  'pending_schedule', 'scheduled', 'in_progress', 'substantially_complete',
  'closed', 'cancelled'
);

CREATE TYPE equipment_charge_type AS ENUM ('flat', 'per_day', 'per_hour', 'per_job_allocation');

CREATE TYPE activity_event_type AS ENUM (
  'lead_created', 'lead_updated', 'lead_stage_changed', 'estimate_created',
  'estimate_updated', 'estimate_submitted', 'estimate_approved',
  'estimate_revision_requested', 'margin_override', 'proposal_created',
  'proposal_internal_approved', 'proposal_sent', 'proposal_viewed',
  'proposal_client_approved', 'proposal_client_declined', 'job_created',
  'note_added', 'document_uploaded'
);

CREATE TYPE drywall_finish_level AS ENUM ('level_1', 'level_2', 'level_3', 'level_4', 'level_5');

CREATE TYPE plaster_system AS ENUM ('veneer', 'traditional_3_coat', 'skim_coat', 'repair_patch');

CREATE TYPE window_size_tier AS ENUM ('small', 'medium', 'large', 'picture');
```

---

## Tables

### `users`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| email | VARCHAR(255) | UNIQUE NOT NULL | Login |
| password_hash | VARCHAR(255) | NOT NULL | Auth |
| first_name | VARCHAR(100) | NOT NULL | |
| last_name | VARCHAR(100) | NOT NULL | |
| role | user_role | NOT NULL | RBAC |
| phone | VARCHAR(20) | | |
| is_active | BOOLEAN | DEFAULT true | |
| avatar_url | TEXT | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_users_email`, `idx_users_role`

---

### `clients`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PK | |
| external_crm_id | VARCHAR(100) | | HubSpot/GHL contact ID |
| first_name | VARCHAR(100) | NOT NULL | |
| last_name | VARCHAR(100) | NOT NULL | |
| company_name | VARCHAR(200) | | Commercial |
| email | VARCHAR(255) | | Dedup key |
| phone | VARCHAR(20) | | Dedup key |
| billing_street | VARCHAR(255) | | |
| billing_city | VARCHAR(100) | | |
| billing_state | CHAR(2) | DEFAULT 'MA' | |
| billing_zip | VARCHAR(10) | | |
| jobs_count | INTEGER | DEFAULT 0 | Repeat client detection |
| lifetime_revenue | DECIMAL(12,2) | DEFAULT 0 | |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_clients_email`, `idx_clients_phone`, `idx_clients_external_crm_id`

---

### `leads`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| id | UUID | PK | |
| client_id | UUID | FK → clients.id | |
| lead_number | VARCHAR(20) | UNIQUE NOT NULL | `L-2025-00142` |
| source | lead_source | NOT NULL | Marketing |
| stage | lead_stage | NOT NULL DEFAULT 'new_lead' | Pipeline |
| service_type | service_code | NOT NULL | Primary interest |
| project_type | project_type | NOT NULL DEFAULT 'residential' | |
| project_street | VARCHAR(255) | | |
| project_city | VARCHAR(100) | NOT NULL | Town filter |
| project_state | CHAR(2) | DEFAULT 'MA' | |
| project_zip | VARCHAR(10) | | |
| description | TEXT | | Initial inquiry |
| assigned_sales_user_id | UUID | FK → users.id | |
| assigned_estimator_user_id | UUID | FK → users.id | |
| estimated_value | DECIMAL(12,2) | | Updated when estimate approved |
| lost_reason | TEXT | | |
| contacted_at | TIMESTAMPTZ | | SLA tracking |
| stage_entered_at | TIMESTAMPTZ | DEFAULT now() | Days-in-stage |
| external_crm_id | VARCHAR(100) | | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |

**Indexes:** `idx_leads_stage`, `idx_leads_source`, `idx_leads_project_city`, `idx_leads_created_at`, `idx_leads_assigned_estimator`, `idx_leads_client_id`

---

### `overhead_profiles`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| overhead_pct | DECIMAL(5,4) | NOT NULL — e.g. 0.1800 |
| fixed_overhead_per_job | DECIMAL(10,2) | Optional alternative |
| is_default | BOOLEAN | DEFAULT false |
| effective_date | DATE | |
| active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### `margin_profiles`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| green_min_pct | DECIMAL(5,4) | e.g. 0.3500 |
| yellow_min_pct | DECIMAL(5,4) | e.g. 0.2800 |
| red_min_pct | DECIMAL(5,4) | e.g. 0.0000 (anything below yellow) |
| min_job_charge | DECIMAL(10,2) | e.g. 850.00 |
| small_job_threshold | DECIMAL(10,2) | e.g. 1200.00 |
| small_job_fee | DECIMAL(10,2) | e.g. 150.00 |
| rush_multiplier | DECIMAL(4,3) | e.g. 1.150 |
| rush_material_surcharge_pct | DECIMAL(5,4) | e.g. 0.0500 |
| repeat_layout_discount_pct | DECIMAL(5,4) | e.g. 0.1200 |
| repeat_layout_min_units | INTEGER | DEFAULT 4 |
| high_value_threshold | DECIMAL(12,2) | e.g. 25000.00 |
| access_multipliers | JSONB | `{"standard":1.0,"moderate":1.10,...}` |
| rounding_increment | DECIMAL(6,2) | DEFAULT 5.00 |
| pricing_method | VARCHAR(20) | `target_margin` \| `markup` |
| default_markup_pct | DECIMAL(5,4) | If markup method |
| is_default | BOOLEAN | |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### `products`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| sku | VARCHAR(50) | UNIQUE |
| name | VARCHAR(200) | NOT NULL |
| service_code | service_code | NOT NULL |
| unit | quantity_type | NOT NULL |
| unit_cost | DECIMAL(10,4) | NOT NULL |
| coverage_per_unit | DECIMAL(10,4) | Bags: SF per bag |
| default_waste_pct | DECIMAL(5,4) | |
| manufacturer | VARCHAR(100) | |
| spec_sheet_url | TEXT | |
| r_value_per_inch | DECIMAL(4,2) | Insulation products |
| description | TEXT | Proposal display |
| active | BOOLEAN | DEFAULT true |
| effective_date | DATE | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_products_service_code`, `idx_products_sku`, `idx_products_active`

---

### `labor_rates`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| trade_code | VARCHAR(50) | e.g. `insulation_installer` |
| trade_name | VARCHAR(100) | |
| burdened_rate_hr | DECIMAL(8,2) | NOT NULL |
| region | VARCHAR(50) | `boston_metro` |
| effective_date | DATE | |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_labor_rates_trade_code`, `idx_labor_rates_active`

---

### `production_rates`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| service_code | service_code | NOT NULL |
| name | VARCHAR(100) | |
| unit | quantity_type | NOT NULL |
| units_per_hour | DECIMAL(10,4) | NOT NULL |
| crew_size | INTEGER | DEFAULT 2 |
| access_difficulty | access_difficulty | DEFAULT 'standard' |
| finish_level | drywall_finish_level | Nullable, drywall only |
| plaster_system | plaster_system | Nullable |
| notes | TEXT | |
| effective_date | DATE | |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_production_rates_service`, `idx_production_rates_lookup` ON (service_code, access_difficulty, active)

---

### `equipment_rates`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| code | VARCHAR(50) | UNIQUE |
| name | VARCHAR(100) | |
| charge_type | equipment_charge_type | |
| rate_amount | DECIMAL(10,2) | |
| allocation_pct | DECIMAL(5,4) | For per_job_allocation |
| service_codes | service_code[] | Applicable services |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### `pricing_modifiers`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| code | VARCHAR(50) | UNIQUE |
| name | VARCHAR(100) | |
| multiplier | DECIMAL(5,4) | e.g. 1.2000 |
| applies_to | VARCHAR(20) | `labor` \| `material` \| `direct` |
| service_codes | service_code[] | |
| job_conditions | job_condition[] | Auto-apply when matched |
| requires_approval | BOOLEAN | |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

---

### `estimates`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| estimate_number | VARCHAR(20) | UNIQUE `E-2025-00891` |
| lead_id | UUID | FK → leads.id NOT NULL |
| client_id | UUID | FK → clients.id NOT NULL |
| version | INTEGER | DEFAULT 1 |
| parent_estimate_id | UUID | FK → estimates.id, revision chain |
| status | estimate_status | DEFAULT 'draft' |
| estimate_name | VARCHAR(255) | NOT NULL |
| service_type | service_code | Primary service |
| project_type | project_type | |
| project_street | VARCHAR(255) | |
| project_city | VARCHAR(100) | |
| project_state | CHAR(2) | |
| project_zip | VARCHAR(10) | |
| access_difficulty | access_difficulty | |
| job_conditions | job_condition[] | |
| is_rush | BOOLEAN | DEFAULT false |
| is_repeat_layout | BOOLEAN | DEFAULT false |
| repeat_unit_count | INTEGER | Multifamily |
| margin_target_pct | DECIMAL(5,4) | |
| margin_profile_id | UUID | FK → margin_profiles.id |
| overhead_profile_id | UUID | FK → overhead_profiles.id |
| estimator_user_id | UUID | FK → users.id |
| approved_by_user_id | UUID | FK → users.id |
| approved_at | TIMESTAMPTZ | |
| valid_until | DATE | |
| notes_internal | TEXT | |
| notes_client | TEXT | |
| direct_cost_total | DECIMAL(12,2) | Computed rollup |
| mobilization_cost | DECIMAL(10,2) | |
| small_job_fee | DECIMAL(10,2) | |
| overhead_cost | DECIMAL(12,2) | |
| cost_before_profit | DECIMAL(12,2) | |
| sell_price | DECIMAL(12,2) | Pre-round |
| rounded_price | DECIMAL(12,2) | Client-facing |
| gross_margin_pct | DECIMAL(5,4) | |
| margin_status | margin_status | |
| approval_required | BOOLEAN | |
| min_job_adjusted | BOOLEAN | DEFAULT false |
| is_preliminary | BOOLEAN | Plans-based |
| calculation_snapshot | JSONB | Full formula audit trail |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_estimates_lead_id`, `idx_estimates_status`, `idx_estimates_estimator`, `idx_estimates_created_at`, `idx_estimates_margin_status`

---

### `estimate_line_items`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| estimate_id | UUID | FK → estimates.id ON DELETE CASCADE |
| sort_order | INTEGER | |
| service_code | service_code | |
| assembly_name | VARCHAR(255) | |
| area_name | VARCHAR(100) | |
| quantity_type | quantity_type | |
| quantity_raw | DECIMAL(12,4) | |
| quantity_normalized | DECIMAL(12,4) | After BF conversion etc. |
| thickness_inches | DECIMAL(6,2) | |
| r_value_target | INTEGER | |
| product_id | UUID | FK → products.id |
| waste_pct | DECIMAL(5,4) | |
| production_rate_id | UUID | FK → production_rates.id |
| labor_rate_id | UUID | FK → labor_rates.id |
| equipment_rate_id | UUID | FK → equipment_rates.id, nullable |
| modifier_ids | UUID[] | |
| drywall_finish_level | drywall_finish_level | |
| plaster_system | plaster_system | |
| window_size_tier | window_size_tier | |
| window_count | INTEGER | |
| material_cost | DECIMAL(12,2) | Computed |
| labor_hours | DECIMAL(10,4) | |
| labor_cost | DECIMAL(12,2) | |
| equipment_cost | DECIMAL(12,2) | |
| line_direct_cost | DECIMAL(12,2) | |
| client_description | TEXT | Proposal-facing |
| calculation_detail | JSONB | Per-line formula audit |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_line_items_estimate_id`, `idx_line_items_service_code`

---

### `margin_overrides`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| estimate_id | UUID | FK → estimates.id |
| user_id | UUID | FK → users.id |
| reason | TEXT | NOT NULL |
| previous_margin_status | margin_status | |
| new_margin_status | margin_status | |
| previous_sell_price | DECIMAL(12,2) | |
| approved_to_send | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

---

### `proposals`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| proposal_number | VARCHAR(20) | UNIQUE |
| estimate_id | UUID | FK → estimates.id |
| version | INTEGER | DEFAULT 1 |
| status | proposal_status | DEFAULT 'draft' |
| is_preliminary | BOOLEAN | |
| deposit_pct | DECIMAL(5,4) | DEFAULT 0.50 |
| deposit_amount | DECIMAL(12,2) | |
| approved_amount | DECIMAL(12,2) | Locked at send |
| scope_json | JSONB | AI-generated + edited |
| assumptions_json | JSONB | |
| exclusions_json | JSONB | |
| schedule_start_window | VARCHAR(100) | |
| schedule_duration_days | INTEGER | |
| terms_template_id | UUID | FK → terms_templates.id |
| pdf_url | TEXT | |
| pdf_hash | VARCHAR(64) | SHA-256 |
| view_token | VARCHAR(64) | UNIQUE |
| sent_at | TIMESTAMPTZ | |
| sent_by_user_id | UUID | FK → users.id |
| viewed_at | TIMESTAMPTZ | |
| view_count | INTEGER | DEFAULT 0 |
| client_approved_at | TIMESTAMPTZ | |
| client_declined_at | TIMESTAMPTZ | |
| decline_reason | TEXT | |
| signature_data | JSONB | |
| internal_approved_by | UUID | FK → users.id |
| internal_approved_at | TIMESTAMPTZ | |
| expires_at | DATE | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_proposals_estimate_id`, `idx_proposals_status`, `idx_proposals_view_token`, `idx_proposals_sent_at`

---

### `terms_templates`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| name | VARCHAR(100) | e.g. "Residential Standard MA" |
| body_html | TEXT | Merge fields: `{{deposit_pct}}` |
| is_default | BOOLEAN | |
| active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### `jobs`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| job_number | VARCHAR(20) | UNIQUE `J-2025-00301` |
| proposal_id | UUID | FK → proposals.id UNIQUE |
| lead_id | UUID | FK → leads.id |
| client_id | UUID | FK → clients.id |
| status | job_status | DEFAULT 'pending_schedule' |
| contract_amount | DECIMAL(12,2) | From proposal |
| deposit_received | DECIMAL(12,2) | |
| scheduled_start | DATE | |
| actual_start | DATE | |
| substantial_completion_date | DATE | |
| gross_margin_pct_at_sale | DECIMAL(5,4) | Snapshot |
| project_address | JSONB | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:** `idx_jobs_status`, `idx_jobs_client_id`, `idx_jobs_created_at`

---

### `activity_logs`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| event_type | activity_event_type | |
| lead_id | UUID | FK nullable |
| estimate_id | UUID | FK nullable |
| proposal_id | UUID | FK nullable |
| job_id | UUID | FK nullable |
| client_id | UUID | FK nullable |
| user_id | UUID | FK nullable — actor |
| payload | JSONB | Event details |
| created_at | TIMESTAMPTZ | DEFAULT now() |

**Indexes:** `idx_activity_created_at`, `idx_activity_lead_id`, `idx_activity_event_type`, `idx_activity_estimate_id`

---

### `marketing_ad_spend`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| source | lead_source | |
| period_start | DATE | |
| period_end | DATE | |
| amount | DECIMAL(10,2) | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

**Index:** `idx_ad_spend_source_period` ON (source, period_start, period_end)

---

### `alerts`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| alert_type | VARCHAR(50) | `stale_lead`, `low_margin`, etc. |
| severity | VARCHAR(20) | `info`, `warning`, `critical` |
| lead_id | UUID | FK nullable |
| estimate_id | UUID | FK nullable |
| proposal_id | UUID | FK nullable |
| message | TEXT | |
| is_read | BOOLEAN | DEFAULT false |
| is_dismissed | BOOLEAN | DEFAULT false |
| assigned_user_id | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | |

**Indexes:** `idx_alerts_assigned_unread` ON (assigned_user_id, is_read) WHERE NOT is_dismissed

---

### `documents`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| lead_id | UUID | FK nullable |
| estimate_id | UUID | FK nullable |
| file_name | VARCHAR(255) | |
| file_url | TEXT | |
| mime_type | VARCHAR(100) | |
| uploaded_by_user_id | UUID | FK → users.id |
| created_at | TIMESTAMPTZ | |

---

## Relationships Diagram

```
users ─────────────┬──────────────────────────────────┐
                   │                                  │
clients 1──* leads 1──* estimates 1──* estimate_line_items
   │         │              │                    │
   │         │              ├── margin_profile    ├── products
   │         │              ├── overhead_profile  ├── labor_rates
   │         │              │                    ├── production_rates
   │         │              └── * proposals       └── equipment_rates
   │         │                       │
   │         └── * activity_logs     └── 1 jobs
   │
   └── jobs_count updated on job.closed
```

---

## Recommended Indexes (Performance)

```sql
-- Dashboard: leads by week
CREATE INDEX idx_leads_created_at_stage ON leads (created_at DESC, stage);

-- Pipeline value
CREATE INDEX idx_estimates_approved_price ON estimates (rounded_price)
  WHERE status = 'approved';

-- Proposal conversion
CREATE INDEX idx_proposals_sent_status ON proposals (sent_at, status)
  WHERE sent_at IS NOT NULL;

-- Estimator leaderboard
CREATE INDEX idx_estimates_estimator_created ON estimates (estimator_user_id, created_at DESC);

-- Town filter
CREATE INDEX idx_leads_project_city_created ON leads (project_city, created_at DESC);
```

---

## Foreign Key Cascade Rules

| Child | On delete parent |
|-------|------------------|
| estimate_line_items | CASCADE from estimates |
| proposals | RESTRICT from estimates (archive estimate instead) |
| jobs | RESTRICT from proposals |
| activity_logs | SET NULL (preserve audit) |

---

## Seed Data Requirements

On first deploy, seed:
1. One `margin_profile` (Boston Default)
2. One `overhead_profile` (18%)
3. Products per service (minimum 1 per service_code)
4. Labor rates: installer, finisher, plasterer, window installer
5. Production rates: standard access per service
6. Equipment rates: spray rig, blower, mobilization
7. Terms template: Residential Standard MA
8. Admin user

See `prisma/seed.ts` for values.
