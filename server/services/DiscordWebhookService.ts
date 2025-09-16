// Using built-in fetch API (available in Node.js 18+)

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export enum NotificationType {
  ERROR = 'ERROR',
  SERVER_PROVISIONING_FAILED = 'SERVER_PROVISIONING_FAILED', 
  RATE_LIMIT = 'RATE_LIMIT'
}

class DiscordWebhookService {
  private webhookUrl: string | undefined;
  private adminRoleId: string | undefined;
  private botName: string = 'MODL Admin';
  private avatarUrl: string = '';

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
  }

  // Update webhook configuration from panel settings
  updateConfig(webhookSettings: {
    discordWebhookUrl?: string;
    discordAdminRoleId?: string;
    botName?: string;
    avatarUrl?: string;
    enabled?: boolean;
  }) {
    if (webhookSettings.enabled && webhookSettings.discordWebhookUrl) {
      this.webhookUrl = webhookSettings.discordWebhookUrl;
      this.adminRoleId = webhookSettings.discordAdminRoleId;
      this.botName = webhookSettings.botName || 'MODL Admin';
      this.avatarUrl = webhookSettings.avatarUrl || '';
    } else {
      // Fallback to environment variables if not configured in panel
      this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      this.adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
      this.botName = 'MODL Admin';
      this.avatarUrl = '';
    }
  }

  private getEmbedColor(type: NotificationType): number {
    switch (type) {
      case NotificationType.ERROR:
        return 0xFF0000; // Red
      case NotificationType.SERVER_PROVISIONING_FAILED:
        return 0xFF6600; // Orange
      case NotificationType.RATE_LIMIT:
        return 0xFFFF00; // Yellow
      default:
        return 0x808080; // Gray
    }
  }

  private shouldPingAdmins(type: NotificationType): boolean {
    return type === NotificationType.ERROR || 
           type === NotificationType.SERVER_PROVISIONING_FAILED;
  }

  async sendNotification(
    type: NotificationType,
    title: string,
    description: string,
    fields?: Array<{ name: string; value: string; inline?: boolean }>,
    additionalContent?: string
  ): Promise<void> {
    if (!this.webhookUrl) {
      // Silently return if webhook not configured - no need to log warnings
      return;
    }

    try {
      const embed: DiscordEmbed = {
        title,
        description,
        color: this.getEmbedColor(type),
        timestamp: new Date().toISOString(),
        footer: {
          text: 'MODL Admin Notification System'
        }
      };

      if (fields && fields.length > 0) {
        embed.fields = fields;
      }

      const payload: DiscordWebhookPayload = {
        username: this.botName,
        embeds: [embed]
      };

      // Add role ping for critical notifications
      if (this.shouldPingAdmins(type) && this.adminRoleId) {
        payload.content = `<@&${this.adminRoleId}> ${additionalContent || 'Critical notification!'}`;
      } else if (additionalContent) {
        payload.content = additionalContent;
      }

      if (this.avatarUrl) {
        payload.avatar_url = this.avatarUrl;
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Silently fail - webhook errors shouldn't break the main application flow
        return;
      }
    } catch (error) {
      // Silently fail - webhook errors shouldn't break the main application flow
      return;
    }
  }

  async sendPanelError(error: Error, request?: any): Promise<void> {
    const fields = [
      {
        name: 'Error Message',
        value: error.message || 'Unknown error',
        inline: false
      },
      {
        name: 'Stack Trace',
        value: `\`\`\`${(error.stack || 'No stack trace').substring(0, 1000)}\`\`\``,
        inline: false
      }
    ];

    if (request) {
      fields.push({
        name: 'Request Info',
        value: `**Method:** ${request.method || 'N/A'}\n**URL:** ${request.originalUrl || request.url || 'N/A'}\n**IP:** ${request.ip || 'N/A'}`,
        inline: false
      });
    }

    await this.sendNotification(
      NotificationType.ERROR,
      '🚨 Panel Error Detected',
      'An error occurred in the admin panel',
      fields
    );
  }

  async sendServerProvisioningFailure(
    serverId: string,
    serverName: string,
    error: string,
    additionalInfo?: Record<string, any>
  ): Promise<void> {
    const fields = [
      {
        name: 'Server ID',
        value: serverId,
        inline: true
      },
      {
        name: 'Server Name', 
        value: serverName,
        inline: true
      },
      {
        name: 'Error',
        value: error,
        inline: false
      }
    ];

    if (additionalInfo) {
      Object.entries(additionalInfo).forEach(([key, value]) => {
        fields.push({
          name: key,
          value: String(value),
          inline: true
        });
      });
    }

    await this.sendNotification(
      NotificationType.SERVER_PROVISIONING_FAILED,
      '⚠️ Server Provisioning Failed',
      `Failed to provision server: ${serverName}`,
      fields
    );
  }

  async sendRateLimitNotification(
    userId: string,
    endpoint: string,
    ip: string,
    limit: number,
    windowMs: number
  ): Promise<void> {
    const fields = [
      {
        name: 'User ID',
        value: userId || 'Anonymous',
        inline: true
      },
      {
        name: 'IP Address',
        value: ip,
        inline: true
      },
      {
        name: 'Endpoint',
        value: endpoint,
        inline: false
      },
      {
        name: 'Rate Limit',
        value: `${limit} requests per ${windowMs / 1000 / 60} minutes`,
        inline: false
      }
    ];

    await this.sendNotification(
      NotificationType.RATE_LIMIT,
      '⏱️ Rate Limit Hit',
      'A user has hit the rate limit',
      fields
    );
  }

  isConfigured(): boolean {
    return !!this.webhookUrl;
  }
}

export const discordWebhookService = new DiscordWebhookService();