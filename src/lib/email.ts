export async function sendProposalEmail(opts: {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  pdfBase64?: string;
  pdfFilename?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'proposals@smoothconstruction.com';

  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — logging email:', opts.to, opts.subject);
    return { sent: false, logged: true };
  }

  const attachments = opts.pdfBase64
    ? [{ filename: opts.pdfFilename ?? 'proposal.pdf', content: opts.pdfBase64 }]
    : undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      cc: opts.cc,
      subject: opts.subject,
      html: opts.html,
      attachments,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Email send failed: ${err}`);
  }

  return { sent: true, logged: false };
}
