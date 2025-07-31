import mongoose, { Model } from 'mongoose';
import { IModlServer, ModlServerSchema } from '@modl-gg/shared-web';
import { discordWebhookService } from './DiscordWebhookService';

interface FailedServerTracker {
  serverId: string;
  firstSeenAt: Date;
  notificationSent: boolean;
}

class ServerProvisioningMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private failedServers: Map<string, FailedServerTracker> = new Map();
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly NOTIFICATION_DELAY_MS = 10 * 60 * 1000; // 10 minutes

  start() {
    if (this.checkInterval) {
      return;
    }

    console.log('Starting server provisioning monitor...');
    
    // Run initial check
    this.checkFailedServers();
    
    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkFailedServers();
    }, this.CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Stopped server provisioning monitor');
    }
  }

  private getModlServerModel(): Model<IModlServer> {
    return mongoose.models.ModlServer as Model<IModlServer> || 
           mongoose.model<IModlServer>('ModlServer', ModlServerSchema);
  }

  private async checkFailedServers() {
    try {
      const ModlServerModel = this.getModlServerModel();
      
      // Find all servers with failed provisioning status
      const failedServers = await ModlServerModel.find({
        provisioningStatus: 'failed'
      }).select('_id name email plan createdAt updatedAt');

      const currentTime = new Date();
      const currentFailedIds = new Set(failedServers.map(s => s._id.toString()));

      // Remove servers from tracker that are no longer failed
      for (const [serverId, tracker] of this.failedServers.entries()) {
        if (!currentFailedIds.has(serverId)) {
          this.failedServers.delete(serverId);
        }
      }

      // Check each failed server
      for (const server of failedServers) {
        const serverId = server._id.toString();
        let tracker = this.failedServers.get(serverId);

        if (!tracker) {
          // New failed server
          tracker = {
            serverId,
            firstSeenAt: currentTime,
            notificationSent: false
          };
          this.failedServers.set(serverId, tracker);
        }

        // Send notification if delay has passed and not already sent
        const timeSinceFirstSeen = currentTime.getTime() - tracker.firstSeenAt.getTime();
        if (!tracker.notificationSent && timeSinceFirstSeen >= this.NOTIFICATION_DELAY_MS) {
          await this.sendFailureNotification(server);
          tracker.notificationSent = true;
        }
      }

      // Log summary
      if (failedServers.length > 0) {
        console.log(`Server provisioning monitor: ${failedServers.length} failed servers detected`);
      }
    } catch (error) {
      console.error('Error in server provisioning monitor:', error);
    }
  }

  private async sendFailureNotification(server: any) {
    if (!discordWebhookService.isConfigured()) {
      return;
    }

    const timeSinceCreation = new Date().getTime() - new Date(server.createdAt).getTime();
    const hoursSinceCreation = Math.round(timeSinceCreation / (1000 * 60 * 60));

    try {
      const serverData = server as any; // Type assertion to access properties
      await discordWebhookService.sendServerProvisioningFailure(
        server._id.toString(),
        serverData.name || 'Unnamed Server',
        'Server provisioning has been in failed state for over 10 minutes',
        {
          'Email': serverData.email || 'N/A',
          'Plan': serverData.plan || 'N/A',
          'Created': `${hoursSinceCreation} hours ago`,
          'Last Updated': new Date(server.updatedAt).toISOString()
        }
      );
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  // Method to manually check a specific server
  async checkServer(serverId: string) {
    try {
      const ModlServerModel = this.getModlServerModel();
      const server = await ModlServerModel.findById(serverId);
      
      if (server && server.provisioningStatus === 'failed') {
        await this.sendFailureNotification(server);
      }
    } catch (error) {
      console.error('Error checking server:', error);
    }
  }
}

export const serverProvisioningMonitor = new ServerProvisioningMonitor();