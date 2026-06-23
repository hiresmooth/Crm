import { prisma } from '../prisma';

export interface CrmPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const ENV_URLS: Record<string, string | undefined> = {
  hubspot: process.env.HUBSPOT_WEBHOOK_URL,
  ghl: process.env.GHL_WEBHOOK_URL,
  gohighlevel: process.env.GHL_WEBHOOK_URL,
  zoho: process.env.ZOHO_WEBHOOK_URL,
  airtable: process.env.AIRTABLE_WEBHOOK_URL,
  smoothos: process.env.CRM_WEBHOOK_URL,
  generic: process.env.CRM_WEBHOOK_URL,
};

export async function dispatchCrmEvent(event: string, data: Record<string, unknown>) {
  const payload: CrmPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const integrations = await prisma.crmIntegration.findMany({ where: { active: true } });
  const targets: { provider: string; url: string }[] = integrations
    .filter((i) => i.webhookUrl)
    .map((i) => ({ provider: i.provider, url: i.webhookUrl! }));

  for (const [provider, url] of Object.entries(ENV_URLS)) {
    if (url) targets.push({ provider, url });
  }

  const unique = new Map<string, string>();
  for (const t of targets) unique.set(t.url, t.provider);

  await Promise.allSettled(
    Array.from(unique.entries()).map(([url, provider]) =>
      postWebhook(url, provider, payload)
    )
  );
}

async function postWebhook(url: string, provider: string, payload: CrmPayload) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const integration = await prisma.crmIntegration.findUnique({ where: { provider } });
  if (integration?.apiKey) headers['Authorization'] = `Bearer ${integration.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(adaptPayload(provider, payload)),
  });
  if (!res.ok) {
    console.error(`CRM webhook failed [${provider}]:`, res.status, await res.text().catch(() => ''));
  }
}

function adaptPayload(provider: string, payload: CrmPayload): Record<string, unknown> {
  switch (provider) {
    case 'hubspot':
      return {
        eventName: payload.event,
        occurredAt: payload.timestamp,
        properties: payload.data,
      };
    case 'ghl':
    case 'gohighlevel':
      return { type: payload.event, ...payload.data };
    case 'zoho':
      return { event: payload.event, data: payload.data };
  }
  return payload as unknown as Record<string, unknown>;
}
