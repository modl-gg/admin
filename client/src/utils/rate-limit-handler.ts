interface RateLimitResponse {
  error: string;
  retryAfter?: number;
  timeRemaining?: string;
  rateLimit?: string;
  nextAttemptAt?: string;
  message?: string;
  securityNote?: string;
}

export function isRateLimitError(response: Response): boolean {
  return response.status === 429;
}

export async function handleRateLimitResponse(response: Response, currentPath?: string): Promise<void> {
  try {
    const rateLimitData: RateLimitResponse = await response.json();
    const { toast } = await import('@modl-gg/shared-web/hooks/use-toast');

    const errorMessage = rateLimitData.error || 'Too many requests. Please try again later.';
    const timeInfo = rateLimitData.timeRemaining ? ` Please wait ${rateLimitData.timeRemaining}.` : '';

    toast({
      title: errorMessage + timeInfo,
      description: rateLimitData.securityNote || rateLimitData.message,
      variant: 'destructive',
    });
  } catch (error) {
    const { toast } = await import('@modl-gg/shared-web/hooks/use-toast');
    toast({
      title: 'Rate limit exceeded',
      description: 'Too many requests. Please wait before trying again.',
      variant: 'destructive',
    });
  }
}

export function getCurrentPath(): string {
  return window.location.pathname;
}
