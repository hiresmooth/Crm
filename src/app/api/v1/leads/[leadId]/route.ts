import { apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { leadId: string } }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: {
      client: true,
      estimates: { orderBy: { createdAt: 'desc' } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
      assignedSales: { select: { firstName: true, lastName: true } },
      assignedEstimator: { select: { firstName: true, lastName: true } },
    },
  });

  if (!lead) {
    return Response.json({ success: false, errors: [{ code: 'NOT_FOUND', message: 'Lead not found' }] }, { status: 404 });
  }

  const proposals = await prisma.proposal.findMany({
    where: { estimate: { leadId: lead.id } },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess({ ...lead, proposals });
}
