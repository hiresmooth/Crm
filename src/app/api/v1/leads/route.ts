import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, nextNumber } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/events';

const leadSchema = z.object({
  source: z.enum([
    'google_business', 'website_organic', 'google_ads', 'direct_call',
    'referral', 'facebook_instagram', 'chatbot', 'repeat_client', 'other',
  ]),
  client: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    company_name: z.string().optional().nullable(),
  }).refine((c) => c.email || c.phone, { message: 'email or phone required' }),
  project: z.object({
    street: z.string().optional(),
    city: z.string().min(1),
    state: z.string().default('MA'),
    zip: z.string().optional(),
    type: z.enum(['residential', 'multifamily', 'commercial', 'municipal']).default('residential'),
  }),
  service_type: z.enum([
    'closed_cell_foam', 'open_cell_foam', 'attic_insulation', 'basement_insulation',
    'crawl_space_insulation', 'blow_in_insulation', 'air_sealing',
    'drywall', 'plastering', 'window_replacement',
  ]),
  description: z.string().optional(),
  assigned_sales_user_id: z.string().uuid().optional().nullable(),
  external_crm_id: z.string().optional().nullable(),
});

export async function GET() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { client: true, estimates: { select: { id: true, status: true, roundedPrice: true } } },
  });
  return apiSuccess(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors.map((e) => ({
        code: 'VALIDATION_ERROR',
        field: e.path.join('.'),
        message: e.message,
      }))
    );
  }

  const data = parsed.data;
  const count = await prisma.lead.count();
  const leadNumber = nextNumber('L', count + 1);

  let client = await prisma.client.findFirst({
    where: {
      OR: [
        data.client.email ? { email: data.client.email } : undefined,
        data.client.phone ? { phone: data.client.phone } : undefined,
      ].filter(Boolean) as { email?: string; phone?: string }[],
    },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        firstName: data.client.first_name,
        lastName: data.client.last_name,
        email: data.client.email ?? null,
        phone: data.client.phone ?? null,
        companyName: data.client.company_name ?? null,
      },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      leadNumber,
      clientId: client.id,
      source: data.source,
      serviceType: data.service_type,
      projectType: data.project.type,
      projectStreet: data.project.street,
      projectCity: data.project.city,
      projectState: data.project.state,
      projectZip: data.project.zip,
      description: data.description,
      assignedSalesUserId: data.assigned_sales_user_id,
      externalCrmId: data.external_crm_id,
    },
    include: { client: true },
  });

  await emitEvent({
    eventType: 'lead_created',
    leadId: lead.id,
    clientId: client.id,
    payload: { source: data.source, service_type: data.service_type },
    crmPayload: {
      lead_id: lead.id,
      lead_number: lead.leadNumber,
      source: data.source,
      service_type: data.service_type,
      client: {
        first_name: client.firstName,
        last_name: client.lastName,
        email: client.email,
        phone: client.phone,
      },
      project: { city: data.project.city, state: data.project.state, zip: data.project.zip },
      stage: lead.stage,
    },
  });

  return apiSuccess(
    {
      lead_id: lead.id,
      lead_number: lead.leadNumber,
      client_id: client.id,
      stage: lead.stage,
      duplicate: false,
    },
    201
  );
}
