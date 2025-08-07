import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { discordWebhookService, NotificationType } from '../services/DiscordWebhookService';
import PM2LogService from '../services/PM2LogService';

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

    // Test PM2 log notification
    if (type === 'all' || type === 'pm2') {
      // Simulate a PM2 error log by directly calling the Discord notification method
      await discordWebhookService.sendNotification(
        NotificationType.ERROR,
        '❌ PM2 Error Detected (Test)',
        'A test error level log occurred in the modl-panel PM2 instance',
        [
          {
            name: 'Error Message',
            value: 'Test PM2 error: This is a simulated error from the PM2 log service integration test',
            inline: false
          },
          {
            name: 'Source',
            value: 'modl-panel',
            inline: true
          },
          {
            name: 'Category',
            value: 'pm2',
            inline: true
          },
          {
            name: 'Timestamp',
            value: new Date().toISOString(),
            inline: true
          },
          {
            name: 'Metadata',
            value: '```json\n{\n  "pm2Instance": "modl-panel",\n  "originalLine": "2024-01-01 12:00:00: [ERROR] Test error message",\n  "testMode": true\n}\n```',
            inline: false
          }
        ]
      );
      notifications.push('PM2 log error notification');
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
 * POST /api/test-notifications/pm2-log
 * Test PM2 log Discord webhook integration by simulating log entries
 */
router.post('/pm2-log', async (req: Request, res: Response) => {
  try {
    const { level = 'error', message = 'Test PM2 log message' } = req.body;

    if (!discordWebhookService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Discord webhook is not configured. Please set DISCORD_WEBHOOK_URL environment variable.'
      });
    }

    // Validate log level
    if (!['info', 'warning', 'error', 'critical'].includes(level)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid log level. Must be one of: info, warning, error, critical'
      });
    }

    // Create a test log entry
    const testLogEntry = {
      timestamp: new Date(),
      level: level as 'info' | 'warning' | 'error' | 'critical',
      message: `Test PM2 Log (${level.toUpperCase()}): ${message}`,
      source: 'modl-panel',
      category: 'pm2',
      metadata: {
        pm2Instance: 'modl-panel',
        originalLine: `${new Date().toISOString()}: [${level.toUpperCase()}] ${message}`,
        testMode: true,
        requestedBy: 'test-api'
      }
    };

    // Use the PM2LogService test method to simulate processing this log
    // This will trigger the Discord webhook if the level is error or critical
    PM2LogService.testLogEntry(testLogEntry);

    return res.json({
      success: true,
      message: `Test PM2 log processed successfully`,
      data: {
        logEntry: testLogEntry,
        notificationSent: level === 'error' || level === 'critical',
        webhookConfigured: true
      }
    });
  } catch (error) {
    console.error('Test PM2 log error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process test PM2 log',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/test-notifications/status
 * Check Discord webhook configuration status
 */
router.get('/status', async (_req: Request, res: Response) => {
  const pm2Status = PM2LogService.getStatus();

  const status = {
    webhookConfigured: discordWebhookService.isConfigured(),
    webhookUrl: process.env.DISCORD_WEBHOOK_URL ? 'Set (hidden)' : 'Not set',
    adminRoleId: process.env.DISCORD_ADMIN_ROLE_ID ? 'Set (hidden)' : 'Not set',
    pm2LogService: {
      enabled: pm2Status.isEnabled,
      streaming: pm2Status.isStreaming,
      reconnectAttempts: pm2Status.reconnectAttempts
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasWebhookUrl: !!process.env.DISCORD_WEBHOOK_URL,
      hasAdminRoleId: !!process.env.DISCORD_ADMIN_ROLE_ID,
      pm2LoggingEnabled: process.env.PM2_LOGGING_ENABLED !== 'false'
    }
  };

  return res.json({
    success: true,
    data: status
  });
});

export default router;