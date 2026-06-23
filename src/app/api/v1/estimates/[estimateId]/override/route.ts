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
  reason: z.string().min(5),
  approved_to_send: z.boolean().default(true),
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
      return apiError([{ code: 'VALIDATION_ERROR', message: 'Reason required (min 5 chars)' }]);
    }

    const estimate = await prisma.estimate.findUnique({ where: { id: params.estimateId } });
    if (!estimate) return apiError([{ code: 'NOT_FOUND', message: 'Estimate not found' }], 404);
    if (!estimate.approvalRequired) {
      return apiError([{ code: 'NOT_REQUIRED', message: 'Margin override not required for this estimate' }], 422);
    }

    const override = await prisma.marginOverride.create({
      data: {
        estimateId: estimate.id,
        userId: session.id,
        reason: body.data.reason,
        previousMarginStatus: estimate.marginStatus,
        newMarginStatus: estimate.marginStatus,
        previousSellPrice: estimate.sellPrice,
        approvedToSend: body.data.approved_to_send,
      },
    });

    if (body.data.approved_to_send && estimate.status === 'in_review') {
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedByUserId: session.id,
        },
      });
    }

    await emitEvent({
      eventType: 'margin_override',
      leadId: estimate.leadId,
      estimateId: estimate.id,
      userId: session.id,
      payload: { reason: body.data.reason, approved_to_send: body.data.approved_to_send },
    });

    return apiSuccess({
      override_id: override.id,
      approved_to_send: override.approvedToSend,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError([{ code: 'FORBIDDEN', message: e.message }], 403);
    throw e;
  }
}
