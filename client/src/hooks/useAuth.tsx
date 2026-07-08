import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, type AdminSession } from '@/lib/services/auth-service';

const sessionQueryKey = ['auth', 'session'] as const;

function loggedOutSession(): AdminSession {
  return {
    isAuthenticated: false,
    loggedInIps: [],
  };
}

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    error,
  } = useQuery<AdminSession>({
    queryKey: sessionQueryKey,
    queryFn: () => authService.getSession(),
    staleTime: 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
    onError: (caught) => {
      console.error('Login failed:', caught);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onError: (caught) => {
      console.error('Logout failed:', caught);
    },
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData<AdminSession>(sessionQueryKey, loggedOutSession());
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
