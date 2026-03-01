import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { authService, type AdminSession } from '@/lib/services/auth-service';

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    error,
  } = useQuery<AdminSession>({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      try {
        return await authService.getSession();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          return {
            isAuthenticated: false,
            loggedInIps: [],
          };
        }

        throw caught;
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const requestCodeMutation = useMutation({
    mutationFn: (email: string) => authService.requestCode(email),
    onError: (caught) => {
      console.error('Request code failed:', caught);
    },
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authService.login(email, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
    onError: (caught) => {
      console.error('Login failed:', caught);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
    onError: (caught) => {
      console.error('Logout failed:', caught);
      queryClient.clear();
    },
  });

  return {
    session,
    isAuthenticated: session?.isAuthenticated ?? false,
    isLoading,
    error,

    requestCode: requestCodeMutation.mutate,
    isRequestingCode: requestCodeMutation.isPending,
    requestCodeError: requestCodeMutation.error,

    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };
}
