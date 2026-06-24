import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      success: true,
      data: { status: 'healthy', database: 'connected' },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch {
    return Response.json(
      {
        success: false,
        data: { status: 'unhealthy', database: 'disconnected' },
        errors: [{ code: 'DB_UNAVAILABLE', message: 'Database connection failed' }],
      },
      { status: 503 },
    );
  }
}
