export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditRates, requireAuth, ForbiddenError } from '@/lib/permissions';

const createSchema = z.object({
  name: z.string().min(1),
  body_html: z.string().min(1),
  is_default: z.boolean().default(false),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  body_html: z.string().optional(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function GET() {
  requireAuth(await getSession());
  const templates = await prisma.termsTemplate.findMany({ orderBy: { name: 'asc' } });
  return apiSuccess(templates);
}

export async function POST(request: Request) {
  try {
    const session = requireAuth(await getSession());
    if (!canEditRates(session)) throw new ForbiddenError('Admin access required');

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

    if (parsed.data.is_default) {
      await prisma.termsTemplate.updateMany({ data: { isDefault: false } });
    }

    const template = await prisma.termsTemplate.create({
      data: {
        name: parsed.data.name,
        bodyHtml: parsed.data.body_html,
        isDefault: parsed.data.is_default,
      },
    });
    return apiSuccess(template, 201);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}

export async function PATCH(request: Request) {
  try {
    const session = requireAuth(await getSession());
    if (!canEditRates(session)) throw new ForbiddenError('Admin access required');

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

    const { id, ...fields } = parsed.data;
    if (fields.is_default) {
      await prisma.termsTemplate.updateMany({ data: { isDefault: false } });
    }

    const template = await prisma.termsTemplate.update({
      where: { id },
      data: {
        ...(fields.name ? { name: fields.name } : {}),
        ...(fields.body_html ? { bodyHtml: fields.body_html } : {}),
        ...(fields.is_default !== undefined ? { isDefault: fields.is_default } : {}),
        ...(fields.active !== undefined ? { active: fields.active } : {}),
      },
    });
    return apiSuccess(template);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
