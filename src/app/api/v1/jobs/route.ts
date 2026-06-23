export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      client: true,
      lead: true,
      proposal: { select: { proposalNumber: true, approvedAmount: true } },
    },
  });
  return apiSuccess(jobs);
}
