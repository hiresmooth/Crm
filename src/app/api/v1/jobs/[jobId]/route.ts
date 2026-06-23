export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { hasMinRole, requireAuth } from '@/lib/permissions';

const patchSchema = z.object({
  status: z.enum([
    'pending_schedule', 'scheduled', 'in_progress', 'substantially_complete', 'closed', 'cancelled',
  ]).optional(),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const session = requireAuth(await getSession());
  if (!hasMinRole(session, 'manager')) {
    return apiError([{ code: 'FORBIDDEN', message: 'Manager access required' }], 403);
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const job = await prisma.job.findUnique({ where: { id: params.jobId } });
  if (!job) return apiError([{ code: 'NOT_FOUND', message: 'Job not found' }], 404);

  const data = parsed.data;
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.scheduled_start !== undefined ? { scheduledStart: data.scheduled_start ? new Date(data.scheduled_start) : null } : {}),
      ...(data.scheduled_end !== undefined ? { scheduledEnd: data.scheduled_end ? new Date(data.scheduled_end) : null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: { client: true, lead: true, proposal: true },
  });

  await emitEvent({
    eventType: 'job_created',
    leadId: job.leadId,
    jobId: job.id,
    userId: session.id,
    payload: { status: data.status, action: 'updated' },
  });

  return apiSuccess(updated);
}
