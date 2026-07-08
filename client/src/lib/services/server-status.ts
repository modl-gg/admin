export const SERVER_PLANS = ['free', 'premium'] as const;
export type ServerPlan = (typeof SERVER_PLANS)[number];

export const PROVISIONING_STATUSES = ['pending', 'in-progress', 'completed', 'failed'] as const;
export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];

export type CustomDomainStatus = 'pending' | 'error' | 'active' | 'verifying';

export const SUBSCRIPTION_STATUSES = [
  'active',
  'canceled',
  'past_due',
  'inactive',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function normalizeServerPlan(value: unknown): ServerPlan {
  if (typeof value !== 'string') {
    return 'free';
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'premium' ? 'premium' : 'free';
}

export function normalizeProvisioningStatus(value: unknown): ProvisioningStatus {
  if (typeof value !== 'string') {
    return 'pending';
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return PROVISIONING_STATUSES.find((status) => status === normalized) ?? 'pending';
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return SUBSCRIPTION_STATUSES.find((status) => status === normalized);
}
