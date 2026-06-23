export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { apiError, apiSuccess } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { renderProposalPdf } from '@/lib/pdf/render-proposal';
import { saveFile } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: { proposalId: string } }
) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: {
      estimate: {
        include: {
          lineItems: { include: { product: true }, orderBy: { sortOrder: 'asc' } },
          lead: { include: { client: true } },
        },
      },
      termsTemplate: true,
    },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);
  return apiSuccess(proposal);
}

export async function POST(
  _request: Request,
  { params }: { params: { proposalId: string } }
) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: params.proposalId },
    include: {
      estimate: {
        include: {
          lineItems: { orderBy: { sortOrder: 'asc' } },
          lead: { include: { client: true } },
        },
      },
      termsTemplate: true,
    },
  });

  if (!proposal) return apiError([{ code: 'NOT_FOUND', message: 'Proposal not found' }], 404);

  const pdfBuffer = await renderProposalPdf(proposal);
  const pdfHash = await crypto.subtle
    .digest('SHA-256', new Uint8Array(pdfBuffer))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );

  const filename = `${proposal.proposalNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
  const pdfUrl = await saveFile(filename, pdfBuffer);

  const updated = await prisma.proposal.update({
    where: { id: proposal.id },
    data: { pdfUrl, pdfHash },
  });

  return apiSuccess({
    proposal_id: updated.id,
    pdf_url: pdfUrl,
    pdf_hash: pdfHash,
  });
}
