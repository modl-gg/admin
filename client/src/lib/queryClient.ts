import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 Unauthorized errors
        if (error?.status === 401) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // More sensible default for admin panels
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    },
    mutations: {
      retry: false,
    },
  },
}); 