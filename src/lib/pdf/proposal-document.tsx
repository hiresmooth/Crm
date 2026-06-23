import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Proposal, Estimate, Lead, Client, EstimateLineItem } from '@prisma/client';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1A1A1A' },
  headerBar: { height: 4, backgroundColor: '#F26522', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#6B7280', marginBottom: 16 },
  section: { marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#F26522', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#F26522' },
  totalLabel: { fontSize: 14, fontWeight: 'bold' },
  totalValue: { fontSize: 14, fontWeight: 'bold', color: '#F26522' },
  bullet: { marginLeft: 12, marginBottom: 3 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#6B7280', textAlign: 'center' },
});

type ProposalData = Proposal & {
  estimate: Estimate & {
    lineItems: EstimateLineItem[];
    lead: Lead & { client: Client };
  };
  termsTemplate?: { bodyHtml: string } | null;
};

export function ProposalPdfDocument({ proposal }: { proposal: ProposalData }) {
  const scope = proposal.scopeJson as {
    project_summary?: string;
    scope_of_work?: { heading: string; bullets: string[] }[];
    assumptions?: string[];
    exclusions?: string[];
  } | null;

  const client = proposal.estimate.lead.client;
  const amount = Number(proposal.approvedAmount ?? proposal.estimate.roundedPrice ?? 0);
  const deposit = Number(proposal.depositAmount ?? amount * 0.5);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar} />
        <Text style={styles.title}>Smooth Construction Services</Text>
        <Text style={styles.subtitle}>Proposal {proposal.proposalNumber}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <Text>{client.firstName} {client.lastName}</Text>
          <Text>{client.email}</Text>
          <Text>{client.phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project</Text>
          <Text>{proposal.estimate.projectStreet ?? proposal.estimate.lead.projectStreet}</Text>
          <Text>{proposal.estimate.projectCity}, {proposal.estimate.projectState} {proposal.estimate.projectZip}</Text>
        </View>

        {scope?.project_summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Project Summary</Text>
            <Text>{scope.project_summary}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scope of Work</Text>
          {(scope?.scope_of_work ?? proposal.estimate.lineItems.map((l) => ({
            heading: l.assemblyName,
            bullets: [l.clientDescription ?? l.assemblyName],
          }))).map((section, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>{section.heading}</Text>
              {section.bullets.map((b, j) => (
                <Text key={j} style={styles.bullet}>• {b}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Summary</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Investment</Text>
            <Text style={styles.totalValue}>${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
          <Text style={{ marginTop: 8 }}>Deposit required: ${deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({Number(proposal.depositPct) * 100}%)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <Text>Start window: {proposal.scheduleStartWindow ?? '2–3 weeks from deposit'}</Text>
          <Text>Estimated duration: {proposal.scheduleDurationDays ?? 2} day(s)</Text>
        </View>

        {(scope?.exclusions ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exclusions</Text>
            {scope!.exclusions!.map((e, i) => (
              <Text key={i} style={styles.bullet}>• {e}</Text>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Smooth Construction Services · Boston, MA · smoothconstruction.com · Valid until {proposal.expiresAt ? new Date(proposal.expiresAt).toLocaleDateString() : '30 days'}
        </Text>
      </Page>
    </Document>
  );
}
