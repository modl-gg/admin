const STAGING_DOMAIN_SUFFIX = 'modl.top';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function isStagingHost(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname.endsWith(STAGING_DOMAIN_SUFFIX) || LOCAL_HOSTNAMES.has(hostname);
}
