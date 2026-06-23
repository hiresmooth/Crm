import { getSession } from '@/lib/auth';
import { canManageCrm } from '@/lib/permissions';
import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  const session = await getSession();
  if (!canManageCrm(session)) return apiError([{ code: 'FORBIDDEN', message: 'Admin only' }], 403);
  const data = await prisma.crmIntegration.findMany({ orderBy: { provider: 'asc' } });
  return apiSuccess(data);
}

const schema = z.object({
  provider: z.string(),
  name: z.string(),
  webhook_url: z.string().url().optional().nullable(),
  api_key: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!canManageCrm(session)) return apiError([{ code: 'FORBIDDEN', message: 'Admin only' }], 403);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const data = await prisma.crmIntegration.upsert({
    where: { provider: parsed.data.provider },
    update: {
      name: parsed.data.name,
      webhookUrl: parsed.data.webhook_url,
      apiKey: parsed.data.api_key,
      active: true,
    },
    create: {
      provider: parsed.data.provider,
      name: parsed.data.name,
      webhookUrl: parsed.data.webhook_url,
      apiKey: parsed.data.api_key,
      active: true,
    },
  });

  return apiSuccess(data, 201);
}
