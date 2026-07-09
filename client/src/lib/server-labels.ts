import { capitalizeFirst } from '@/lib/utils';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  premium: 'Premium',
};

const PROVISIONING_STATUS_LABELS: Record<string, string> = {
  completed: 'Active',
  pending: 'Provisioning',
  'in-progress': 'Provisioning',
  failed: 'Failed',
};

export function normalizeProvisioningStatus(status: string): string {
  return status.trim().toLowerCase().replace(/_/g, '-');
}

export function planLabel(plan: string): string {
  const normalized = plan.trim().toLowerCase();
  return PLAN_LABELS[normalized] ?? (normalized ? capitalizeFirst(normalized) : 'Unknown');
}

export function provisioningStatusLabel(status: string): string {
  const normalized = normalizeProvisioningStatus(status);
  return PROVISIONING_STATUS_LABELS[normalized] ?? (normalized ? capitalizeFirst(normalized) : 'Unknown');
}
