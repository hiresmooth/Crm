export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { canApproveEstimates, requireAuth, ForbiddenError } from '@/lib/permissions';

const schema = z.object({
  notes: z.string().min(1, 'Revision notes required'),
});

export async function POST(
  request: Request,
  { params }: { params: { estimateId: string } }
) {
  try {
    const session = requireAuth(await getSession());
    if (!canApproveEstimates(session)) {
      throw new ForbiddenError('Manager role required');
    }

    const body = schema.safeParse(await request.json());
    if (!body.success) {
      return apiError([{ code: 'VALIDATION_ERROR', message: body.error.errors[0]?.message ?? 'Invalid input' }]);
    }

    const estimate = await prisma.estimate.findUnique({ where: { id: params.estimateId } });
    if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
    if (estimate.status !== 'in_review') {
      return apiError([{ code: 'INVALID_STATUS', message: 'Estimate must be in_review' }], 422);
    }

    const updated = await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'revision_requested' },
    });

    await emitEvent({
      eventType: 'estimate_revision_requested',
      leadId: estimate.leadId,
      estimateId: estimate.id,
      userId: session.id,
      payload: { notes: body.data.notes },
    });

    return apiSuccess({
      estimate_id: updated.id,
      status: updated.status,
      revision_notes: body.data.notes,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
