import type { Estimate, EstimateLineItem, Lead, Client, Product } from '@prisma/client';
import { generateProposalScope } from '../proposal-scope';

type EstimateWithLines = Estimate & {
  lineItems: (EstimateLineItem & { product: Product })[];
  lead: Lead & { client: Client };
};

const SYSTEM_PROMPT = `You are a proposal writer for Smooth Construction Services, a Boston-area insulation, drywall, plastering, and weatherization contractor.

RULES:
1. Use ONLY facts from the provided JSON estimate payload.
2. Never invent pricing, discounts, warranties, or permit outcomes.
3. Never promise start dates — use "estimated window" language from schedule_fields.
4. Scope bullets must map 1:1 to line items provided.
5. Tone: professional, direct, contractor-confident. No hype.
6. If thickness or R-value is null, do not mention it.

OUTPUT valid JSON only:
{
  "project_summary": "string, max 80 words",
  "scope_of_work": [{ "heading": "string", "bullets": ["string"] }],
  "assumptions": ["string"],
  "exclusions": ["string"]
}`;

export async function generateProposalScopeWithAi(
  estimate: EstimateWithLines,
  schedule?: { start_window?: string; duration_days?: number }
) {
  const fallback = generateProposalScope(estimate);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ...fallback, _source: 'rules' as const };

  const payload = {
    client: {
      name: `${estimate.lead.client.firstName} ${estimate.lead.client.lastName}`,
      city: estimate.projectCity,
    },
    rounded_price: Number(estimate.roundedPrice),
    line_items: estimate.lineItems.map((l) => ({
      assembly_name: l.assemblyName,
      product: l.product.name,
      quantity: Number(l.quantityRaw),
      unit: l.quantityType,
      thickness: l.thicknessInches ? Number(l.thicknessInches) : null,
      r_value: l.rValueTarget,
    })),
    job_conditions: estimate.jobConditions,
    access_difficulty: estimate.accessDifficulty,
    schedule_fields: schedule ?? {},
    exclusion_templates: [
      'Moving stored items',
      'Electrical/plumbing repairs',
      'Asbestos abatement',
      'Permit fees unless included',
    ],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Write proposal scope JSON from this estimate data only:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
    });

    if (!res.ok) return { ...fallback, _source: 'rules' as const };

    const json = await res.json();
    const text = json.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...fallback, _source: 'rules' as const };

    const parsed = JSON.parse(match[0]);
    return {
      project_summary: parsed.project_summary ?? fallback.project_summary,
      scope_of_work: parsed.scope_of_work ?? fallback.scope_of_work,
      assumptions: parsed.assumptions ?? fallback.assumptions,
      exclusions: parsed.exclusions ?? fallback.exclusions,
      _source: 'ai' as const,
    };
  } catch {
    return { ...fallback, _source: 'rules' as const };
  }
}
