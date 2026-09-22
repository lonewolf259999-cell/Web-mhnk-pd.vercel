import type { Metadata } from 'next';
import { RosterManagePanel } from '@/components/forms/RosterManagePanel';

export const metadata: Metadata = {
  title: 'จัดการสถานะ - MHNK Police Department',
};

export default function RosterManagePage() {
  return <RosterManagePanel />;
}
