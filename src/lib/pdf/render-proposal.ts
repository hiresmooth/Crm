import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { ProposalPdfDocument } from './proposal-document';
import type { Proposal, Estimate, Lead, Client, EstimateLineItem, TermsTemplate } from '@prisma/client';

type ProposalWithRelations = Proposal & {
  estimate: Estimate & {
    lineItems: EstimateLineItem[];
    lead: Lead & { client: Client };
  };
  termsTemplate?: TermsTemplate | null;
};

export async function renderProposalPdf(proposal: ProposalWithRelations): Promise<Buffer> {
  const element = React.createElement(ProposalPdfDocument, { proposal });
  const buffer = await renderToBuffer(element as React.ReactElement);
  return Buffer.from(buffer);
}
