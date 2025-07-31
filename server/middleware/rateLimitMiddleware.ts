import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { discordWebhookService } from '../services/DiscordWebhookService';

interface CustomRateLimitOptions extends Partial<Options> {
  notificationThreshold?: number; // Send notification after N hits
}

export function createRateLimiter(
  windowMs: number,
  max: number,
  message: any,
  endpointName: string,
  options?: CustomRateLimitOptions
): RateLimitRequestHandler {
  const notificationThreshold = options?.notificationThreshold || max;
  const hitCounts = new Map<string, number>();

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request) => {
      // Use IP address as the key
      return req.ip || 'unknown';
    },
    handler: async (req: Request, res: Response) => {
      const key = req.ip || 'unknown';
      const userId = (req.session as any)?.adminId || 'Anonymous';
      
      // Track hit counts
      const currentHits = (hitCounts.get(key) || 0) + 1;
      hitCounts.set(key, currentHits);
      
      // Send Discord notification when threshold is reached
      if (currentHits === notificationThreshold && discordWebhookService.isConfigured()) {
        discordWebhookService.sendRateLimitNotification(
          userId,
          `${req.method} ${req.originalUrl}`,
          key,
          max,
          windowMs
        ).catch(err => console.error('Failed to send rate limit notification:', err));
      }
      
      // Reset hit count after window expires
      setTimeout(() => {
        hitCounts.delete(key);
      }, windowMs);
      
      // Send the rate limit response
      res.status(429).json(message);
    },
    ...options
  });
}

// Export pre-configured rate limiters
export const loginRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  {
    success: false,
    error: 'Too many login attempts, please try again later'
  },
  'Login Endpoint'
);

export const codeRequestRateLimit = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  3, // 3 requests
  {
    success: false,
    error: 'Too many code requests, please try again later'
  },
  'Code Request Endpoint'
);

export const configUpdateRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // 20 updates
  {
    success: false,
    error: 'Too many configuration updates, please try again later'
  },
  'Configuration Update Endpoint',
  { notificationThreshold: 15 } // Notify at 15 hits instead of 20
);