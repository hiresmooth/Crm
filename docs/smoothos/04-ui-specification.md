# SmoothOS Internal UI Specification
## Estimator · Proposal · Dashboard · Lead Detail

**App shell:** Next.js 14 App Router, sidebar nav, role-based routes  
**Design tokens:** Orange `#F26522`, Black `#1A1A1A`, Gray `#6B7280`, Success `#16A34A`, Warning `#EAB308`, Danger `#DC2626`

---

## Global Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] SmoothOS Estimate     [Search]  [Alerts●3]  [User ▾]      │
├────────────┬─────────────────────────────────────────────────────┤
│ Dashboard  │                                                     │
│ Leads      │              MAIN CONTENT AREA                      │
│ Estimates  │                                                     │
│ Proposals  │                                                     │
│ Admin ▾    │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

**Breakpoints:** Desktop-first (1280px+); estimator collapses to 2-column on tablet; mobile read-only dashboard.

---

## Page 1: Estimator Page

**Route:** `/estimates/[estimateId]` or `/estimates/new?leadId=`  
**Roles:** estimator, manager, admin (sales: read-only)

### Page Header

| Element | Spec |
|---------|------|
| Breadcrumb | Leads → Lead #L-2025-00142 → Estimate E-2025-00891 |
| Title | Editable `estimate_name` inline |
| Status badge | `draft` gray, `in_review` blue, `approved` green, `revision_requested` orange |
| Margin badge | Green/Yellow/Red pill with GM% — sticky top-right |
| Version | `v2` if revision |
| Actions | Save Draft · Submit for Review · Generate Proposal (disabled states below) |

**Button states:**
- Submit for Review: enabled if `status=draft|revision_requested` and ≥1 line item
- Generate Proposal: enabled if `status=approved` only
- Save Draft: always (unless `in_review` and not manager)

### Section A: Lead / Project Panel (Left Column, 280px)

**Card: Client & Lead**
| Field | Control | Editable |
|-------|---------|----------|
| Client name | Link to client | No (from lead) |
| Phone / Email | Click-to-call/mail | No |
| Lead source | Badge | No |
| Lead stage | Dropdown (sales/manager) | Role-gated |
| Project address | Address autocomplete | Yes |
| Project type | Select | Yes |
| Service type (primary) | Select | Yes |
| Assigned estimator | User select | Manager |

**Card: Job Conditions**
| Field | Control |
|-------|---------|
| Access difficulty | Radio: Standard / Moderate / Difficult / Extreme |
| Job conditions | Multi-checkbox: Occupied, New construction, Remediation, Winter, Hazmat-adjacent |
| Rush job | Toggle |
| Repeat layout (multifamily) | Toggle + unit count input (shows if multifamily) |
| Valid until | Date picker, default +30d |
| Internal notes | Textarea, red "INTERNAL ONLY" label |
| Client notes | Textarea |

### Section B: Assembly Builder (Center, flex)

**Card: Add Line Item**
- Service selector: icon grid or dropdown grouped by Insulation / Weatherization / Finishes / Windows
- On select → dynamic form fields per service (see formulas doc)
- Button: `+ Add to Estimate`

**Card: Line Item Pricing Table**

| Column | Visible | Notes |
|--------|---------|-------|
| ⠿ Sort | Yes | Drag reorder |
| Assembly | Yes | assembly_name |
| Area | Yes | area_name |
| Service | Yes | icon + code |
| Qty | Yes | raw + unit |
| Thickness/R | Yes | if applicable |
| Product | Yes | dropdown |
| Material $ | Yes internal | hidden from sales read-only |
| Labor hrs | Yes internal | |
| Labor $ | Yes internal | |
| Equip $ | Yes internal | |
| Direct $ | Yes | bold |
| ⋮ | Yes | Edit · Duplicate · Delete |

**Row click:** Opens line item drawer for edit.

**Empty state:** "No line items yet. Select a service above to build your estimate."

### Section C: Rate Assumptions Drawer (Slide-over from header link)

**Trigger:** `Rate Assumptions` button in header

| Section | Contents |
|---------|----------|
| Margin target | Slider/input % — default from profile |
| Margin profile | Read-only name + thresholds table |
| Overhead profile | Read-only % |
| Mobilization | Computed $ + distance note |
| Small job fee | Preview if applicable |
| Waste overrides | List per line with warning if > default |
| Active modifiers | Chips with multipliers |

Manager/admin: link `Edit rate tables →` to admin.

### Section D: Pricing Summary Panel (Right Column, 320px, sticky)

**Card: Pricing Summary**

```
Line items direct      $4,218.40
Mobilization             $350.00
Small job fee              $0.00
─────────────────────────────────
Direct cost total      $4,568.40
Overhead (18%)           $822.31
─────────────────────────────────
Cost before profit     $5,390.71
Target margin (35%)    
Sell price (calc)      $8,293.40
Rounded price          $8,295.00  ← CLIENT PRICE
Gross margin           35.0%  [GREEN]
```

**Card: Margin Alert** (conditional)
- Yellow: "Below target margin — manager approval required before proposal."
- Red: "Margin critically low — locked until manager override."
- Min job: "Minimum job charge applied — margin recalculated."

**Card: Approval** (if in_review — manager only)
- Approve · Request Revision (reason required)

**Card: Actions**
- Save Draft (secondary)
- Submit for Review (primary)
- Generate Proposal (primary, approved only)

### Warnings / Toasts

| Condition | UI |
|-----------|-----|
| No line items on submit | Blocking modal |
| Yellow/red margin on submit | Confirm modal for estimator; auto-routes to manager |
| High value ≥$25k | Banner: "Manager approval required" |
| Stale rate table (>90 days) | Yellow banner admin only |

### Workflow States on Page

| Estimate status | Estimator can edit lines | Manager sees approval |
|-----------------|--------------------------|----------------------|
| draft | Yes | No |
| in_review | No (unless manager) | Yes |
| approved | No — must create revision | No |
| revision_requested | Yes | Notes panel shown |

---

## Page 2: Proposal Generator / Review Page

**Route:** `/proposals/[proposalId]`  
**Roles:** manager, admin, sales (send only if approved)

### Page Header

| Element | Spec |
|---------|------|
| Proposal # | SCS-2025-00421 |
| Status badge | Full proposal workflow state |
| Estimate link | E-2025-00891 (approved) |
| Version selector | Dropdown v1, v2 — loads immutable prior PDFs |
| Actions | Regenerate PDF · Submit for Internal Approval · Send Proposal |

### Layout: 3-Column

#### Left: Editable Content (360px)

**Card: Client & Project** (read-only from estimate)

**Card: Scope of Work**
- AI `Generate Scope` button (from estimate lines)
- Editable sections per assembly heading
- Each bullet: text input, delete, reorder
- Warning footer: "Do not add work not in estimate line items"

**Card: Assumptions**
- Checklist from templates + free text rows

**Card: Exclusions**
- Template blocks (permits, asbestos, furniture moving, paint)
- AI-suggested from job_conditions (editable)

**Card: Schedule**
| Field | Control |
|-------|---------|
| Start window | Text: "2–3 weeks from deposit" |
| Duration | Number days |
| Site readiness bullets | Editable list |

**Card: Terms**
- Terms template selector dropdown
- Preview accordion
- Deposit % (default 50)
- Preliminary quote toggle

#### Center: Proposal Preview (flex)

- Live HTML preview matching PDF layout
- Orange header bar, client block, scope, price summary, terms, signature block
- `Preview as Client` toggle (hides internal badges)
- PDF render iframe after generation

**Price summary rules:** Show `rounded_price` only. Optional grouped subtotals by service category — never unit prices.

#### Right: Send & Tracking (300px)

**Card: Internal Approval**
- Timeline: Created → Internal Review → Approved
- Approver name + timestamp
- Reject with reason

**Card: Send Proposal**
| Field | Spec |
|-------|------|
| To | client email (editable) |
| CC | optional |
| Subject | Template merge |
| Message | Editable body |
| Attach PDF | Auto-checked |
| Send button | Enabled if `internal_approved` |

**Card: Client Tracking**
| Metric | Display |
|--------|---------|
| Sent at | datetime |
| Viewed | datetime + view count |
| Approved / Declined | status + amount |
| Expires | date countdown |

**Card: Version History**
- Table: version, date, user, status, PDF download link
- Click row → load read-only preview

### Warnings

| Condition | UI |
|-----------|-----|
| Estimate not approved | Block all send actions |
| Scope line count ≠ estimate lines | Yellow warning |
| Expired validity | Red — must extend estimate valid_until |
| PDF not generated | Send disabled |

### Workflow States

```
draft → internal_review → internal_approved → sent → viewed → client_approved | client_declined
```

---

## Page 3: Dashboard Page

**Route:** `/dashboard`  
**Roles:** all (KPI scope varies); manager/admin see all data

### Filter Bar (sticky)

| Filter | Control |
|--------|---------|
| Date range | Presets: This week, This month, Last 30d, QTD, Custom |
| Service type | Multi-select |
| Lead source | Multi-select |
| Town | Searchable multi-select (project_city) |
| Estimator | User multi-select |
| Stage | Pipeline stages |
| Job value tier | <5k, 5–15k, 15–25k, 25k+ |
| Apply / Reset | Buttons |

### Row 1: KPI Cards (8 cards)

| Card | Value | Subtext | Click → |
|------|-------|---------|---------|
| Leads | 24 | +3 vs last period | Leads filtered |
| Estimates | 18 | 75% of leads | Estimates list |
| Proposals sent | 11 | | Proposals list |
| Jobs won | 6 | | Jobs list |
| Close rate | 54.5% | proposals→won | |
| Projected revenue | $142,500 | open approvals | Pipeline |
| Booked revenue | $89,200 | | Jobs |
| Avg gross margin | 34.2% | won jobs | Service dashboard |

### Row 2: Charts (2-column)

**Left (60%): Pipeline Funnel**
- Horizontal funnel: stage → count + $ value
- Hover: avg days in stage
- Red segment overlay for overdue count

**Right (40%): Revenue Trend**
- Line chart: weekly booked (solid) vs projected (dashed)
- 12-week default window

### Row 3: Tables + Charts

**Left: Service Performance Table**

| Service | Leads | Estimates | Won | Win % | Avg Margin | Avg Value |
|---------|-------|-----------|-----|-------|------------|-----------|

Sortable columns. Row click → filtered lead list.

**Right: Marketing Source Chart**
- Donut: leads by source
- Toggle metric: Leads / Revenue / CPL

### Row 4: Estimator Leaderboard + Alerts

**Leaderboard table (50%)**

| Estimator | Estimates | Avg Turnaround | Win % | Revisions | Avg Margin |
|-----------|-----------|----------------|-------|-----------|------------|

**Alerts panel (50%)**
- Scrollable list, severity icon
- Actions: View lead · Dismiss · Assign
- Filter: All / Mine / Critical

### Alert Types Display

| Type | Icon | Message template |
|------|------|------------------|
| new_lead | blue | "New lead from {source}: {name}" |
| stale_lead | yellow | "No contact in 24h: {lead#}" |
| proposal_viewed | orange | "Proposal viewed, no response: {proposal#}" |
| low_margin | red | "Low margin estimate: {estimate#} at {gm}%" |
| high_value | purple | "High-value lead: ${value}" |
| repeat_client | green | "Repeat client: {name}" |
| follow_up_overdue | red | "Follow-up overdue {n} days: {lead#}" |

### Empty / Loading States

- Skeleton cards on load
- "No data for filters" with reset CTA

---

## Page 4: Lead Detail Page

**Route:** `/leads/[leadId]`  
**Roles:** sales, estimator, manager, admin, office

### Page Header

| Element | Spec |
|---------|------|
| Lead # | L-2025-00142 |
| Stage badge | Pipeline stage with dropdown (role-gated) |
| Primary service | Badge |
| Source | Badge |
| Created | datetime |
| Actions | Log Call · Create Estimate · Mark Lost · Edit |

### Layout: 2-Column Main + Bottom Timeline

#### Left Column (65%)

**Card: Contact**
- Client name, phone, email, company
- Billing address
- Repeat client badge if `jobs_count > 0`
- Link to CRM record (external)

**Card: Project**
- Project address (map link)
- Town, zip
- Project type
- Description from inquiry
- Photos/documents upload dropzone

**Card: Estimates** (table)

| # | Name | Status | Amount | Estimator | Created | Actions |
|---|------|--------|--------|-----------|---------|---------|

Actions: Open · Duplicate · New Version

**Card: Proposals** (table)

| # | Version | Status | Amount | Sent | Viewed | Actions |
|---|---------|--------|--------|------|--------|---------|

Actions: Open · Resend · Download PDF

**Card: Job** (if won)
- Job #, status, contract amount, schedule, link to job module

#### Right Column (35%)

**Card: Assignment**
- Sales rep dropdown
- Estimator dropdown
- Estimated value (auto from latest approved estimate)

**Card: SLA / Follow-Up**
- Days in current stage (progress bar vs SLA)
- Next follow-up date picker
- `Mark Contacted` button → sets contacted_at

**Card: Lost Reason** (if stage=lost)
- Required reason select + notes

**Card: Quick Notes**
- Add note input → saves to activity log

#### Bottom: Activity Timeline (full width)

Reverse chronological:
- Stage changes
- Estimates created/submitted/approved
- Proposals sent/viewed/approved
- Notes
- Documents uploaded

Each entry: icon, actor, timestamp, expandable payload.

### Workflow Actions by Stage

| Stage | Primary CTA |
|-------|-------------|
| new_lead | Mark Contacted |
| contacted | Create Estimate |
| estimate_in_progress | Open Estimate |
| proposal_sent | Log Follow-Up |
| follow_up_needed | Resend / Call |
| won | View Job |
| lost | Reopen (manager) |

### Warnings

| Condition | UI |
|-----------|-----|
| SLA breach | Red banner top |
| Duplicate lead detected | Yellow merge suggestion |
| Open estimate in draft > 5 days | Yellow nudge |

---

## Shared Components

| Component | Usage |
|-----------|-------|
| `MarginBadge` | Green/yellow/red/min-job |
| `CurrencyDisplay` | Internal vs client mode |
| `WorkflowTimeline` | Proposals, leads |
| `ServiceIcon` | Line items, filters |
| `ConfirmModal` | Destructive + submit actions |
| `InternalOnlyTag` | Red label on sensitive fields |

---

## Role Visibility Matrix

| Field / Section | Estimator | Sales | Manager | Admin |
|-----------------|-----------|-------|---------|-------|
| Unit costs | Yes | No | Yes | Yes |
| Labor hours | Yes | No | Yes | Yes |
| Gross margin % | Yes | No | Yes | Yes |
| Margin override | No | No | Yes | Yes |
| Send proposal | No | Yes* | Yes | Yes |
| Edit rate tables | No | No | No | Yes |

*Sales: only after internal approval

---

## Navigation Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+S` | Save draft (estimator) |
| `/` | Focus global search |
| `g d` | Go dashboard |
| `g l` | Go leads |
