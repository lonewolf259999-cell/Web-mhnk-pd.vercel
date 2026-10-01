import type { Metadata } from 'next';
import { LogsClient } from '@/components/police/LogsClient';

export const metadata: Metadata = {
  title: 'Log & Debug - MHNK Police Department',
};

export default function PoliceLogsPage() {
  return <LogsClient />;
}
