import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const schema = z.object({
  lead_id: z.string().uuid().optional(),
  estimate_id: z.string().uuid().optional(),
  file_name: z.string(),
  file_url: z.string().url(),
  mime_type: z.string().default('application/pdf'),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return apiError([{ code: 'UNAUTHORIZED', message: 'Login required' }], 401);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError([{ code: 'VALIDATION_ERROR', message: 'Invalid input' }]);

  const doc = await prisma.document.create({
    data: {
      leadId: parsed.data.lead_id,
      estimateId: parsed.data.estimate_id,
      fileName: parsed.data.file_name,
      fileUrl: parsed.data.file_url,
      mimeType: parsed.data.mime_type,
      uploadedByUserId: session.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      eventType: 'document_uploaded',
      leadId: parsed.data.lead_id,
      estimateId: parsed.data.estimate_id,
      userId: session.id,
      payload: { file_name: parsed.data.file_name },
    },
  });

  return apiSuccess(doc, 201);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('lead_id');
  const estimateId = searchParams.get('estimate_id');

  const docs = await prisma.document.findMany({
    where: {
      ...(leadId ? { leadId } : {}),
      ...(estimateId ? { estimateId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess(docs);
}
