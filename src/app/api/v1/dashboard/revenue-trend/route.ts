export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { subWeeks, startOfWeek, format } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periods = Number(searchParams.get('periods') ?? 12);
  const points = [];

  for (let i = periods - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i));
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const booked = await prisma.job.aggregate({
      _sum: { contractAmount: true },
      where: { createdAt: { gte: weekStart, lt: weekEnd } },
    });
    const projected = await prisma.proposal.aggregate({
      _sum: { approvedAmount: true },
      where: {
        sentAt: { gte: weekStart, lt: weekEnd },
        status: { in: ['sent', 'viewed', 'internal_approved'] },
        clientApprovedAt: null,
      },
    });
    points.push({
      period: format(weekStart, "yyyy-'W'II"),
      booked: Number(booked._sum.contractAmount ?? 0),
      projected: Number(projected._sum.approvedAmount ?? 0),
    });
  }

  return apiSuccess({ points });
}
