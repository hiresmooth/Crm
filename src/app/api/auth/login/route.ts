import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookieOptions } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: [{ code: 'VALIDATION_ERROR', message: 'Invalid email or password' }] },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, errors: [{ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }] },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { success: false, errors: [{ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }] },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  const res = NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    },
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
