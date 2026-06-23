import { z } from 'zod';
import { calculateEstimate } from '@/lib/pricing-engine';
import { apiError, apiSuccess } from '@/lib/api';
import { buildLineItemInput, loadRateContext, marginProfileToInput } from '@/lib/estimate-calc';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const schema = z.object({
  lead_id: z.string().uuid(),
  estimate_name: z.string(),
  unit_count: z.number().int().min(2),
  unit_template: z.object({
    service_code: z.string(),
    assembly_name: z.string(),
    quantity_raw: z.number(),
    product_id: z.string().uuid(),
    thickness_inches: z.number().optional(),
  }),
  margin_target_pct: z.number().default(0.35),
  is_repeat_layout: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return apiError([{ code: 'UNAUTHORIZED', message: 'Login required' }], 401);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const data = parsed.data;
  const lead = await prisma.lead.findUnique({ where: { id: data.lead_id } });
  if (!lead) return apiError([{ code: 'NOT_FOUND', message: 'Lead not found' }], 404);

  const rates = await loadRateContext(prisma);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: data.unit_template.product_id } });
  const productionRate = await prisma.productionRate.findFirstOrThrow({
    where: { serviceCode: data.unit_template.service_code as never, active: true },
  });
  const laborRate = await prisma.laborRate.findFirstOrThrow({ where: { active: true } });

  const templateInput = buildLineItemInput({
    serviceCode: data.unit_template.service_code as never,
    quantityType: 'sq_ft',
    quantityRaw: data.unit_template.quantity_raw,
    thicknessInches: data.unit_template.thickness_inches,
    wastePct: Number(product.defaultWastePct),
    product,
    productionRate,
    laborRate,
    accessDifficulty: 'standard',
    marginProfile: rates.marginProfile,
    isRush: false,
    isRepeatLayout: data.is_repeat_layout,
    repeatUnitCount: data.unit_count,
    jobConditions: [],
  });

  const lineInputs = Array.from({ length: data.unit_count }, (_, i) => ({
    ...templateInput,
    assembly_name: `${data.unit_template.assembly_name} — Unit ${i + 1}`,
  }));

  const { line_outputs, rollup } = calculateEstimate({
    lines: lineInputs,
    margin_target_pct: data.margin_target_pct,
    margin_profile: marginProfileToInput(rates.marginProfile),
    overhead_pct: Number(rates.overheadProfile.overheadPct),
    project_zip: lead.projectZip ?? '02118',
  });

  const count = await prisma.estimate.count();
  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber: `E-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
      leadId: lead.id,
      clientId: lead.clientId,
      estimateName: data.estimate_name,
      serviceType: data.unit_template.service_code as never,
      projectType: 'multifamily',
      projectCity: lead.projectCity,
      projectZip: lead.projectZip,
      accessDifficulty: 'standard',
      jobConditions: [],
      isRepeatLayout: true,
      repeatUnitCount: data.unit_count,
      marginTargetPct: data.margin_target_pct,
      marginProfileId: rates.marginProfile.id,
      overheadProfileId: rates.overheadProfile.id,
      estimatorUserId: session.id,
      validUntil: new Date(Date.now() + 30 * 86400000),
      directCostTotal: rollup.direct_cost_total,
      mobilizationCost: rollup.mobilization_cost,
      smallJobFee: rollup.small_job_fee,
      overheadCost: rollup.overhead_cost,
      costBeforeProfit: rollup.cost_before_profit,
      sellPrice: rollup.sell_price,
      roundedPrice: rollup.rounded_price,
      grossMarginPct: rollup.gross_margin_pct,
      marginStatus: rollup.margin_status,
      approvalRequired: rollup.approval_required,
      lineItems: {
        create: lineInputs.map((li, i) => ({
          sortOrder: i + 1,
          serviceCode: data.unit_template.service_code as never,
          assemblyName: `${data.unit_template.assembly_name} — Unit ${i + 1}`,
          quantityType: 'sq_ft' as never,
          quantityRaw: data.unit_template.quantity_raw,
          quantityNormalized: line_outputs[i].quantity_normalized,
          thicknessInches: data.unit_template.thickness_inches,
          productId: product.id,
          wastePct: Number(product.defaultWastePct),
          productionRateId: productionRate.id,
          laborRateId: laborRate.id,
          modifierIds: [],
          materialCost: line_outputs[i].material_cost,
          laborHours: line_outputs[i].labor_hours,
          laborCost: line_outputs[i].labor_cost,
          equipmentCost: line_outputs[i].equipment_cost,
          lineDirectCost: line_outputs[i].line_direct_cost,
          calculationDetail: line_outputs[i].calculation_detail as object,
        })),
      },
    },
  });

  return apiSuccess({ estimate_id: estimate.id, rollup, unit_count: data.unit_count }, 201);
}
