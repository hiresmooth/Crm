import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmoothOS Estimate — Smooth Construction Services',
  description: 'Formula-driven estimating and proposals for Smooth Construction Services',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
