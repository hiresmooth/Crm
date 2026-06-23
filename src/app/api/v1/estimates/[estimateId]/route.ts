import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { estimateId: string } }
) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: {
      lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
      lead: { include: { client: true } },
      marginProfile: true,
      overheadProfile: true,
      estimator: { select: { firstName: true, lastName: true, email: true } },
      proposals: true,
    },
  });

  if (!estimate) {
    return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
  }

  return apiSuccess(estimate);
}
