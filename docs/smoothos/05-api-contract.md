# SmoothOS API Contract
## REST API v1

**Base URL:** `https://api.smoothos.internal/v1`  
**Auth:** Bearer JWT (role claims) or API key for webhooks (scoped)  
**Content-Type:** `application/json`  
**Idempotency:** `Idempotency-Key` header on POST for lead intake and proposal send

---

## Common Response Envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "request_id": "req_abc123", "timestamp": "2025-06-23T14:30:00Z" },
  "errors": null
}
```

**Error envelope:**
```json
{
  "success": false,
  "data": null,
  "meta": { "request_id": "req_abc123" },
  "errors": [
    { "code": "VALIDATION_ERROR", "field": "client.email", "message": "Invalid email format" }
  ]
}
```

---

## Status Codes

| Code | Usage |
|------|-------|
| 200 | GET success, PATCH success |
| 201 | POST created |
| 204 | DELETE success |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden (role or margin lock) |
| 404 | Not found |
| 409 | Conflict (duplicate lead, invalid state transition) |
| 422 | Business rule violation (e.g. send unapproved proposal) |
| 429 | Rate limited |
| 500 | Server error |

---

## 1. Lead Intake

### `POST /leads`

Create lead from website, chatbot, CRM sync, or manual integration.

**Auth:** API key (`scope: leads:write`) or JWT (`sales|office|admin`)

**Request:**
```json
{
  "source": "website_organic",
  "client": {
    "first_name": "Maria",
    "last_name": "Santos",
    "email": "maria.santos@email.com",
    "phone": "+16175551234",
    "company_name": null
  },
  "project": {
    "street": "42 Elm Street",
    "city": "Somerville",
    "state": "MA",
    "zip": "02143",
    "type": "residential"
  },
  "service_type": "attic_insulation",
  "description": "Attic feels drafty, interested in blow-in insulation and air sealing.",
  "assigned_sales_user_id": null,
  "external_crm_id": "hs_918273645",
  "utm": {
    "campaign": "spring_weatherization",
    "medium": "cpc",
    "source": "google"
  }
}
```

**Validation rules:**
| Field | Rule |
|-------|------|
| source | Required, valid `lead_source` enum |
| client.first_name | Required, 1–100 chars |
| client.last_name | Required |
| client.email OR client.phone | At least one required |
| client.email | Valid email if present |
| project.city | Required |
| service_type | Required, valid enum |
| project.type | Optional, default `residential` |

**Dedup logic:** If email or phone matches client with lead in `new_lead|contacted` within 30 days → `409` with `existing_lead_id` unless `?force=true`.

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lead_number": "L-2025-00142",
    "client_id": "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "stage": "new_lead",
    "duplicate": false,
    "alerts_created": ["new_lead"]
  }
}
```

**Side effects:**
- Create `activity_log` event `lead_created`
- CRM webhook outbound `lead.created`
- Assign round-robin sales if `assigned_sales_user_id` null

---

### `GET /leads/{leadId}`

**Auth:** JWT any role except restricted client

**Response `200`:** Full lead object with client, estimates[], proposals[], activity_count.

---

### `PATCH /leads/{leadId}`

Update stage, assignment, notes.

**Request:**
```json
{
  "stage": "contacted",
  "assigned_estimator_user_id": "u-estimator-uuid",
  "contacted_at": "2025-06-23T14:30:00Z"
}
```

**Validation:** Stage transitions must follow allowed graph; `lost` requires `lost_reason`.

---

## 2. Estimate Creation

### `POST /estimates`

**Auth:** JWT (`estimator|manager|admin`)

**Request:**
```json
{
  "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "estimate_name": "42 Elm St — Attic Insulation + Air Sealing",
  "service_type": "attic_insulation",
  "project_type": "residential",
  "project": {
    "street": "42 Elm Street",
    "city": "Somerville",
    "state": "MA",
    "zip": "02143"
  },
  "access_difficulty": "standard",
  "job_conditions": ["occupied"],
  "is_rush": false,
  "is_repeat_layout": false,
  "margin_target_pct": 0.35,
  "margin_profile_id": "mp-default-uuid",
  "overhead_profile_id": "oh-default-uuid",
  "valid_until": "2025-07-23",
  "notes_internal": "Steep roof, verify attic access hatch size.",
  "line_items": [
    {
      "service_code": "attic_insulation",
      "assembly_name": "Attic floor — blow-in cellulose R-49",
      "area_name": "Main attic",
      "quantity_type": "sq_ft",
      "quantity_raw": 1120,
      "r_value_target": 49,
      "thickness_inches": 13.2,
      "product_id": "prod-cellulose-r49-uuid",
      "waste_pct": 0.05,
      "production_rate_id": "pr-attic-blow-uuid",
      "labor_rate_id": "lr-installer-uuid",
      "sort_order": 1
    },
    {
      "service_code": "air_sealing",
      "assembly_name": "Attic air sealing package",
      "quantity_type": "sq_ft",
      "quantity_raw": 1120,
      "penetration_count": 18,
      "duct_seal_count": 4,
      "product_id": "prod-airseal-kit-uuid",
      "waste_pct": 0.05,
      "production_rate_id": "pr-airseal-uuid",
      "labor_rate_id": "lr-installer-uuid",
      "sort_order": 2
    }
  ]
}
```

**Validation rules:**
| Field | Rule |
|-------|------|
| lead_id | Must exist, not `lost` |
| line_items | Min 1 for submit; optional on create draft |
| margin_target_pct | 0.10–0.60 |
| Each line | Service-specific validation per formulas doc |
| product_id | Must be active and match service_code |
| valid_until | Must be future date |

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "estimate_id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "estimate_number": "E-2025-00891",
    "status": "draft",
    "rollup": {
      "direct_cost_total": 4568.40,
      "overhead_cost": 822.31,
      "cost_before_profit": 5390.71,
      "sell_price": 8293.40,
      "rounded_price": 8295.00,
      "gross_margin_pct": 0.350,
      "margin_status": "green",
      "approval_required": false,
      "mobilization_cost": 350.00,
      "small_job_fee": 0.00
    },
    "line_items": [
      {
        "id": "li-uuid-1",
        "assembly_name": "Attic floor — blow-in cellulose R-49",
        "material_cost": 512.64,
        "labor_hours": 1.2444,
        "labor_cost": 84.62,
        "equipment_cost": 43.75,
        "line_direct_cost": 641.01
      }
    ]
  }
}
```

**Side effects:**
- Lead stage → `estimate_in_progress` if was `contacted|new_lead`
- `activity_log` `estimate_created`
- CRM `estimate.created`

---

### `POST /estimates/{estimateId}/calculate`

Recalculate without status change. **Auth:** estimator+

**Response `200`:** Updated rollup + line items (same shape as create).

---

### `POST /estimates/{estimateId}/submit`

**Auth:** estimator (owner or manager)

**Request:** `{}` or `{ "notes": "Ready for review" }`

**Validation:**
- status must be `draft|revision_requested`
- ≥1 line item
- all lines pass validation

**Response `200`:**
```json
{
  "data": {
    "estimate_id": "e1b2c3d4-...",
    "status": "in_review",
    "approval_required": true,
    "margin_status": "yellow"
  }
}
```

**Errors `422`:**
- `MARGIN_LOCK` if red and not manager override
- `INVALID_STATUS`

---

### `POST /estimates/{estimateId}/approve`

**Auth:** manager|admin

**Request:**
```json
{
  "notes": "Approved — margin acceptable for Mass Save program job."
}
```

**Response `200`:** status `approved`, `approved_at`, `approved_by_user_id`

---

## 3. Proposal Generation

### `POST /proposals`

**Auth:** manager|admin|estimator (if estimate approved)

**Request:**
```json
{
  "estimate_id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "terms_template_id": "terms-residential-ma-uuid",
  "deposit_pct": 0.50,
  "is_preliminary": false,
  "schedule": {
    "start_window": "2–3 weeks from deposit receipt",
    "duration_days": 2
  },
  "generate_scope_ai": true
}
```

**Validation:**
- estimate.status = `approved`
- estimate.valid_until >= today
- terms_template exists

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "proposal_id": "p1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "proposal_number": "SCS-2025-00421",
    "version": 1,
    "status": "draft",
    "approved_amount": 8295.00,
    "deposit_amount": 4147.50,
    "scope_json": {
      "project_summary": "Smooth Construction Services will install attic insulation...",
      "scope_of_work": [
        {
          "heading": "Attic Insulation",
          "bullets": ["Install blow-in cellulose to R-49 over 1,120 SF attic floor..."]
        }
      ],
      "assumptions": ["Attic access via existing hatch", "Home occupied during work"],
      "exclusions": ["Moving stored items", "Electrical repairs", "Asbestos abatement"]
    },
    "pdf_url": null
  }
}
```

---

### `POST /proposals/{proposalId}/generate-pdf`

**Auth:** manager|admin|sales

**Response `200`:**
```json
{
  "data": {
    "proposal_id": "p1b2c3d4-...",
    "pdf_url": "https://storage.smoothos.com/proposals/SCS-2025-00421-v1.pdf",
    "pdf_hash": "sha256:abc123..."
  }
}
```

---

### `POST /proposals/{proposalId}/internal-approve`

**Auth:** manager|admin

Moves status `draft|internal_review` → `internal_approved`

---

### `POST /proposals/{proposalId}/send`

**Auth:** sales|manager|admin

**Request:**
```json
{
  "to_email": "maria.santos@email.com",
  "cc_emails": ["sales@smoothconstruction.com"],
  "subject": "Your Smooth Construction Services Proposal — 42 Elm St",
  "message_body": "Hi Maria, please find your proposal attached..."
}
```

**Validation:**
- status = `internal_approved`
- pdf_url not null
- expires_at >= today

**Response `200`:**
```json
{
  "data": {
    "proposal_id": "p1b2c3d4-...",
    "status": "sent",
    "sent_at": "2025-06-23T16:00:00Z",
    "view_token": "vt_secure_random_token",
    "client_view_url": "https://proposals.smoothconstruction.com/v/vt_secure_random_token"
  }
}
```

**Side effects:**
- Lead stage → `proposal_sent`
- CRM `proposal.sent`
- Schedule follow-up alert at +3 days

---

## 4. Proposal Approval (Client)

### `GET /public/proposals/{viewToken}`

**Auth:** None (token-based)

**Response `200`:** Client-safe proposal view (no internal costs).

**Side effect:** First view sets `viewed_at`, status `viewed`, CRM `proposal.viewed`

---

### `POST /public/proposals/{viewToken}/approve`

**Auth:** None + optional email verification code

**Request:**
```json
{
  "signer_name": "Maria Santos",
  "signer_email": "maria.santos@email.com",
  "signature_data": {
    "type": "typed",
    "value": "Maria Santos"
  },
  "accepted_terms": true
}
```

**Validation:**
- accepted_terms = true
- status in `sent|viewed`
- not expired

**Response `200`:**
```json
{
  "data": {
    "proposal_id": "p1b2c3d4-...",
    "status": "client_approved",
    "client_approved_at": "2025-06-24T09:15:00Z",
    "approved_amount": 8295.00,
    "deposit_amount": 4147.50,
    "job_id": "j1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "job_number": "J-2025-00301"
  }
}
```

**Side effects:**
- Create job record
- Lead stage → `won`
- CRM `proposal.approved` + `job.created`

---

### `POST /public/proposals/{viewToken}/decline`

**Request:**
```json
{
  "reason": "Going with another contractor",
  "notes": "Price was fine, chose family referral"
}
```

**Response `200`:** status `client_declined`, lead stage → `lost` (optional config)

---

## 5. Dashboard Metrics

### `GET /dashboard/executive`

**Auth:** manager|admin|sales (scoped to own leads if sales)

**Query params:**
| Param | Type |
|-------|------|
| date_from | ISO date |
| date_to | ISO date |
| service_type | comma-separated enums |
| lead_source | comma-separated |
| town | comma-separated cities |
| estimator_user_id | UUID |
| stage | lead_stage enum |
| value_tier | `<5k` \| `5-15k` \| `15-25k` \| `25k+` |

**Response `200`:**
```json
{
  "data": {
    "kpis": {
      "leads": { "count": 24, "delta_pct": 0.125 },
      "estimates_requested": { "count": 18, "rate_of_leads": 0.75 },
      "proposals_sent": { "count": 11 },
      "jobs_won": { "count": 6 },
      "close_rate": { "value": 0.545, "denominator": "proposals_sent" },
      "projected_revenue": { "amount": 142500.00 },
      "booked_revenue": { "amount": 89200.00 },
      "average_job_size": { "amount": 14866.67 },
      "average_gross_margin": { "value": 0.342 }
    },
    "filters_applied": { "date_from": "2025-06-01", "date_to": "2025-06-23" }
  }
}
```

---

### `GET /dashboard/pipeline`

**Response `200`:**
```json
{
  "data": {
    "stages": [
      {
        "stage": "new_lead",
        "count": 5,
        "total_value": 0,
        "avg_days_in_stage": 0.8,
        "overdue_count": 2
      },
      {
        "stage": "estimate_in_progress",
        "count": 4,
        "total_value": 38500.00,
        "avg_days_in_stage": 3.2,
        "overdue_count": 1
      },
      {
        "stage": "proposal_sent",
        "count": 3,
        "total_value": 42100.00,
        "avg_days_in_stage": 5.1,
        "overdue_count": 1
      }
    ]
  }
}
```

---

### `GET /dashboard/services`

**Response `200`:**
```json
{
  "data": {
    "services": [
      {
        "service_code": "attic_insulation",
        "leads": 12,
        "revenue": 45200.00,
        "win_rate": 0.58,
        "avg_margin": 0.36,
        "avg_estimate_value": 7800.00
      }
    ]
  }
}
```

---

### `GET /dashboard/sources`

**Response `200`:**
```json
{
  "data": {
    "sources": [
      {
        "source": "google_business",
        "leads": 8,
        "estimates": 6,
        "approvals": 3,
        "revenue": 28400.00,
        "conversion_rate": 0.375,
        "cost_per_lead": 42.50,
        "ad_spend": 340.00
      }
    ]
  }
}
```

---

### `GET /dashboard/estimators`

**Response `200`:**
```json
{
  "data": {
    "estimators": [
      {
        "user_id": "u-uuid",
        "name": "James Chen",
        "estimates_created": 14,
        "avg_turnaround_hours": 18.5,
        "win_rate": 0.52,
        "revision_rate": 0.21,
        "avg_margin": 0.34,
        "approval_rate": 0.93
      }
    ]
  }
}
```

---

### `GET /dashboard/alerts`

**Query:** `?assigned_to_me=true&unread_only=true`

**Response `200`:**
```json
{
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "alert_type": "stale_lead",
        "severity": "warning",
        "message": "No contact in 24h: L-2025-00138",
        "lead_id": "lead-uuid",
        "created_at": "2025-06-23T08:00:00Z",
        "is_read": false
      }
    ]
  }
}
```

---

### `GET /dashboard/revenue-trend`

**Query:** `?granularity=week&periods=12`

**Response `200`:**
```json
{
  "data": {
    "points": [
      { "period": "2025-W20", "booked": 12400.00, "projected": 18200.00 },
      { "period": "2025-W21", "booked": 8900.00, "projected": 22100.00 }
    ]
  }
}
```

---

## CRM Webhook Outbound Payloads

### Event: `lead.created`
```json
{
  "event": "lead.created",
  "timestamp": "2025-06-23T14:30:00Z",
  "data": {
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lead_number": "L-2025-00142",
    "source": "website_organic",
    "service_type": "attic_insulation",
    "client": { "first_name": "Maria", "last_name": "Santos", "email": "maria.santos@email.com", "phone": "+16175551234" },
    "project": { "city": "Somerville", "state": "MA", "zip": "02143" },
    "stage": "new_lead",
    "external_crm_id": null
  }
}
```

### Event: `estimate.summary`
```json
{
  "event": "estimate.summary",
  "timestamp": "2025-06-23T15:00:00Z",
  "data": {
    "estimate_id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "estimate_number": "E-2025-00891",
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "approved",
    "rounded_price": 8295.00,
    "gross_margin_pct": 0.35,
    "service_type": "attic_insulation",
    "line_item_count": 2,
    "estimator": { "user_id": "u-uuid", "name": "James Chen" }
  }
}
```

### Event: `proposal.sent`
```json
{
  "event": "proposal.sent",
  "timestamp": "2025-06-23T16:00:00Z",
  "data": {
    "proposal_id": "p1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "proposal_number": "SCS-2025-00421",
    "estimate_id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "client_email": "maria.santos@email.com",
    "approved_amount": 8295.00,
    "deposit_amount": 4147.50,
    "pdf_url": "https://storage.smoothos.com/proposals/SCS-2025-00421-v1.pdf",
    "client_view_url": "https://proposals.smoothconstruction.com/v/vt_secure_random_token",
    "expires_at": "2025-07-23"
  }
}
```

### Event: `proposal.approved`
```json
{
  "event": "proposal.approved",
  "timestamp": "2025-06-24T09:15:00Z",
  "data": {
    "proposal_id": "p1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "proposal_number": "SCS-2025-00421",
    "lead_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "client_id": "c1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "approved_amount": 8295.00,
    "deposit_amount": 4147.50,
    "client_approved_at": "2025-06-24T09:15:00Z",
    "job_id": "j1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "job_number": "J-2025-00301",
    "service_type": "attic_insulation",
    "project_city": "Somerville"
  }
}
```

---

## Rate Limiting

| Endpoint class | Limit |
|----------------|-------|
| Public proposal view | 30/min per IP |
| Lead intake API key | 100/min per key |
| Authenticated API | 300/min per user |

---

## OpenAPI

Full OpenAPI 3.1 spec should be generated at `/v1/openapi.json` from route definitions. Enum values must match PostgreSQL enums in `02-database-schema.md`.
