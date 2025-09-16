import { Connection } from 'mongoose';
import { discordWebhookService } from './DiscordWebhookService';

class WebhookConfigService {
  private connections: Map<string, Connection> = new Map();
  private lastConfigUpdate: Map<string, number> = new Map();
  private readonly configCacheTime = 5 * 60 * 1000; // 5 minutes

  registerConnection(serverName: string, connection: Connection) {
    this.connections.set(serverName, connection);
  }

  async updateWebhookConfig(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return;
    }

    const lastUpdate = this.lastConfigUpdate.get(serverName) || 0;
    const now = Date.now();

    // Only update if it's been more than 5 minutes since last update
    if (now - lastUpdate < this.configCacheTime) {
      return;
    }

    try {
      const SettingsModel = connection.model('Settings');
      const webhookSettingsDoc = await SettingsModel.findOne({ type: 'webhookSettings' });
      
      if (webhookSettingsDoc?.data) {
        const webhookSettings = webhookSettingsDoc.data;
        discordWebhookService.updateConfig(webhookSettings);
        this.lastConfigUpdate.set(serverName, now);
      }
    } catch (error) {
      // Silently fail - don't let webhook config errors affect the main application
      return;
    }
  }

  // Force update webhook config (called when settings are saved)
  async forceUpdateWebhookConfig(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return;
    }

    try {
      const SettingsModel = connection.model('Settings');
      const webhookSettingsDoc = await SettingsModel.findOne({ type: 'webhookSettings' });
      
      if (webhookSettingsDoc?.data) {
        const webhookSettings = webhookSettingsDoc.data;
        discordWebhookService.updateConfig(webhookSettings);
        this.lastConfigUpdate.set(serverName, Date.now());
      }
    } catch (error) {
      // Silently fail
      return;
    }
  }

  // Get webhook settings for a server
  async getWebhookSettings(serverName: string): Promise<any> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return null;
    }

    try {
      const SettingsModel = connection.model('Settings');
      const webhookSettingsDoc = await SettingsModel.findOne({ type: 'webhookSettings' });
      return webhookSettingsDoc?.data || null;
    } catch (error) {
      return null;
    }
  }
}

export const webhookConfigService = new WebhookConfigService();