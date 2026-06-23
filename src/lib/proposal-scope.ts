import type { Estimate, EstimateLineItem, Lead, Client, Product } from '@prisma/client';

type EstimateWithLines = Estimate & {
  lineItems: (EstimateLineItem & { product: Product })[];
  lead: Lead & { client: Client };
};

export function generateProposalScope(estimate: EstimateWithLines) {
  const clientName = `${estimate.lead.client.firstName} ${estimate.lead.client.lastName}`;
  const city = estimate.projectCity ?? estimate.lead.projectCity;

  const scope_of_work = estimate.lineItems.map((line) => ({
    heading: line.assemblyName,
    bullets: [
      buildScopeBullet(line),
    ],
  }));

  const assumptions: string[] = [
    `Project address: ${estimate.projectStreet ?? estimate.lead.projectStreet}, ${city}, ${estimate.projectState ?? 'MA'}`,
    'Work area accessible during normal business hours unless otherwise noted.',
  ];

  if (estimate.jobConditions.includes('occupied')) {
    assumptions.push('Home will be occupied during work.');
  }
  if (estimate.isPreliminary) {
    assumptions.push('Pricing based on preliminary review and subject to field verification.');
  }

  const exclusions: string[] = [
    'Moving or storing personal items and furniture',
    'Electrical, plumbing, or HVAC repairs',
    'Asbestos or lead abatement',
    'Permit fees unless explicitly included',
    'Painting unless specified in scope',
  ];

  return {
    project_summary: `Smooth Construction Services proposes ${scopeSummary(estimate)} for ${clientName} at the project address in ${city}. Total investment: $${Number(estimate.roundedPrice).toLocaleString()}.`,
    scope_of_work,
    assumptions,
    exclusions,
  };
}

function scopeSummary(estimate: EstimateWithLines): string {
  const services = Array.from(new Set(estimate.lineItems.map((l) => formatService(l.serviceCode))));
  return services.join(' and ');
}

function formatService(code: string): string {
  return code.replace(/_/g, ' ');
}

function buildScopeBullet(line: EstimateLineItem & { product: Product }): string {
  const qty = Number(line.quantityRaw);
  const unit = line.quantityType.replace(/_/g, ' ');
  let detail = `Install ${line.product.name} — ${qty.toLocaleString()} ${unit}`;
  if (line.thicknessInches) detail += ` at ${line.thicknessInches}" depth`;
  if (line.rValueTarget) detail += ` (target R-${line.rValueTarget})`;
  if (line.areaName) detail += ` (${line.areaName})`;
  detail += '.';
  return detail;
}
