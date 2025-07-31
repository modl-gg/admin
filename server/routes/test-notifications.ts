import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { discordWebhookService, NotificationType } from '../services/DiscordWebhookService';

const router = Router();

// Apply authentication to all test routes
router.use(requireAuth);

/**
 * POST /api/test-notifications/discord
 * Test Discord webhook notifications
 */
router.post('/discord', async (req: Request, res: Response) => {
  try {
    const { type = 'all' } = req.body;
    
    if (!discordWebhookService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Discord webhook is not configured. Please set DISCORD_WEBHOOK_URL environment variable.'
      });
    }

    const notifications = [];

    // Test panel error notification
    if (type === 'all' || type === 'error') {
      await discordWebhookService.sendPanelError(
        new Error('Test error: This is a test notification'),
        req
      );
      notifications.push('Panel error notification');
    }

    // Test server provisioning failure notification
    if (type === 'all' || type === 'provisioning') {
      await discordWebhookService.sendServerProvisioningFailure(
        'test-server-123',
        'Test Server',
        'Test provisioning failure: This is a test notification',
        {
          'Email': 'test@example.com',
          'Plan': 'premium',
          'Test': 'true'
        }
      );
      notifications.push('Server provisioning failure notification');
    }

    // Test rate limit notification
    if (type === 'all' || type === 'ratelimit') {
      await discordWebhookService.sendRateLimitNotification(
        'test-user-123',
        '/api/test-endpoint',
        req.ip || '127.0.0.1',
        10,
        15 * 60 * 1000
      );
      notifications.push('Rate limit notification');
    }

    return res.json({
      success: true,
      message: 'Test notifications sent successfully',
      data: {
        notificationsSent: notifications,
        webhookConfigured: true,
        adminRoleConfigured: !!process.env.DISCORD_ADMIN_ROLE_ID
      }
    });
  } catch (error) {
    console.error('Test notification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send test notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/test-notifications/status
 * Check Discord webhook configuration status
 */
router.get('/status', async (req: Request, res: Response) => {
  const status = {
    webhookConfigured: discordWebhookService.isConfigured(),
    webhookUrl: process.env.DISCORD_WEBHOOK_URL ? 'Set (hidden)' : 'Not set',
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID ? 'Set (hidden)' : 'Not set',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasWebhookUrl: !!process.env.DISCORD_WEBHOOK_URL,
      hasAdminRoleId: !!process.env.DISCORD_ADMIN_ROLE_ID
    }
  };

  return res.json({
    success: true,
    data: status
  });
});

export default router;