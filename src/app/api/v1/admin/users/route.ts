export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditRates, requireAuth, ForbiddenError } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(['admin', 'manager', 'estimator', 'sales', 'office']),
  phone: z.string().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  role: z.enum(['admin', 'manager', 'estimator', 'sales', 'office']).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export async function GET() {
  const session = requireAuth(await getSession());
  if (!canEditRates(session)) {
    return apiError([{ code: 'FORBIDDEN', message: 'Admin access required' }], 403);
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, isActive: true, createdAt: true },
  });
  return apiSuccess(users);
}

export async function POST(request: Request) {
  try {
    const session = requireAuth(await getSession());
    if (!canEditRates(session)) throw new ForbiddenError('Admin access required');

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(parsed.error.errors.map((e) => ({ code: 'VALIDATION_ERROR', field: e.path.join('.'), message: e.message })));
    }

    const data = parsed.data;
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        phone: data.phone,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    return apiSuccess(user, 201);
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

    const user = await prisma.user.update({
      where: { id: parsed.data.id },
      data: {
        ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {}),
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.first_name ? { firstName: parsed.data.first_name } : {}),
        ...(parsed.data.last_name ? { lastName: parsed.data.last_name } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    return apiSuccess(user);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
