export function buildQueryString(params?: Record<string, string | number | boolean | undefined>): string {
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  const query = queryParams.toString();
  return query ? `?${query}` : '';
}
