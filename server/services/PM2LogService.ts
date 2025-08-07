import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import mongoose from 'mongoose';
import { ISystemLog, SystemLogSchema } from '@modl-gg/shared-web';
import { discordWebhookService, NotificationType } from './DiscordWebhookService';

interface PM2LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  category?: string;
  metadata?: Record<string, any>;
}

class PM2LogService extends EventEmitter {
  private logProcess: ChildProcess | null = null;
  private isStreaming = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isEnabled = process.env.PM2_LOGGING_ENABLED !== 'false'; // Enabled by default

  constructor() {
    super();
  }

  /**
   * Start streaming logs from PM2 instance "modl-panel"
   */
  startStreaming(): void {
    if (!this.isEnabled) {
      console.log('PM2 log streaming is disabled');
      return;
    }

    if (this.isStreaming) {
      console.log('PM2 log streaming already active');
      return;
    }

    console.log('Starting PM2 log streaming for modl-panel...');
    this.isStreaming = true;
    this.startLogProcess();
  }

  /**
   * Stop streaming logs
   */
  stopStreaming(): void {
    console.log('Stopping PM2 log streaming...');
    this.isStreaming = false;
    
    if (this.logProcess) {
      this.logProcess.kill();
      this.logProcess = null;
    }

    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Start the PM2 logs process
   */
  private startLogProcess(): void {
    try {
      // Use pm2 logs command to stream logs from modl-panel instance
      this.logProcess = spawn('pm2', ['logs', 'modl-panel', '--raw', '--timestamp'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.logProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => this.processLogLine(line));
      });

      this.logProcess.stderr?.on('data', (data: Buffer) => {
        console.error('PM2 logs stderr:', data.toString());
        this.processLogLine(data.toString(), 'error');
      });

      this.logProcess.on('close', (code) => {
        console.log(`PM2 logs process closed with code ${code}`);
        this.logProcess = null;
        
        if (this.isStreaming) {
          this.scheduleReconnect();
        }
      });

      this.logProcess.on('error', (error) => {
        console.error('PM2 logs process error:', error);
        this.logProcess = null;
        
        if (this.isStreaming) {
          this.scheduleReconnect();
        }
      });

      // Reset reconnect attempts on successful start
      this.reconnectAttempts = 0;
      console.log('PM2 log streaming started successfully');

    } catch (error) {
      console.error('Failed to start PM2 logs process:', error);
      if (this.isStreaming) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Stopping PM2 log streaming.');
      this.isStreaming = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
    
    console.log(`Reconnecting to PM2 logs in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectInterval = setTimeout(() => {
      if (this.isStreaming) {
        this.startLogProcess();
      }
    }, delay);
  }

  /**
   * Process a single log line from PM2
   */
  private processLogLine(line: string, defaultLevel: 'info' | 'warning' | 'error' | 'critical' = 'info'): void {
    if (!line.trim()) return;

    try {
      const logEntry = this.parseLogLine(line, defaultLevel);

      // Save to database
      this.saveLogToDatabase(logEntry);

      // Emit for real-time updates
      this.emit('newLog', logEntry);

      // Send Discord webhook notification for error and critical logs
      this.sendDiscordNotificationIfNeeded(logEntry);

    } catch (error) {
      console.error('Error processing PM2 log line:', error);
    }
  }

  /**
   * Parse a log line and extract structured information
   */
  private parseLogLine(line: string, defaultLevel: 'info' | 'warning' | 'error' | 'critical'): PM2LogEntry {
    // PM2 log format with timestamp: "2024-01-01 12:00:00: [level] message"
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s*(.+)$/);
    
    let timestamp = new Date();
    let content = line;

    if (timestampMatch) {
      timestamp = new Date(timestampMatch[1]);
      content = timestampMatch[2];
    }

    // Extract log level from content
    let level = defaultLevel;
    const levelMatch = content.match(/^\[(info|warn|warning|error|critical|debug)\]/i);
    if (levelMatch) {
      const extractedLevel = levelMatch[1].toLowerCase();
      switch (extractedLevel) {
        case 'warn':
        case 'warning':
          level = 'warning';
          break;
        case 'error':
          level = 'error';
          break;
        case 'critical':
          level = 'critical';
          break;
        case 'info':
        case 'debug':
        default:
          level = 'info';
          break;
      }
      content = content.replace(levelMatch[0], '').trim();
    }

    // Try to detect error level from content patterns
    if (level === 'info') {
      if (/error|exception|fail/i.test(content)) {
        level = 'error';
      } else if (/warn|warning/i.test(content)) {
        level = 'warning';
      } else if (/critical|fatal/i.test(content)) {
        level = 'critical';
      }
    }

    return {
      timestamp,
      level,
      message: content,
      source: 'modl-panel',
      category: 'pm2',
      metadata: {
        pm2Instance: 'modl-panel',
        originalLine: line
      }
    };
  }

  /**
   * Save log entry to MongoDB
   */
  private async saveLogToDatabase(logEntry: PM2LogEntry): Promise<void> {
    try {
      const SystemLogModel = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);

      const systemLog = new SystemLogModel({
        level: logEntry.level,
        message: logEntry.message,
        source: logEntry.source,
        category: logEntry.category,
        timestamp: logEntry.timestamp,
        metadata: logEntry.metadata,
        resolved: false
      });

      await systemLog.save();
    } catch (error) {
      console.error('Failed to save PM2 log to database:', error);
    }
  }

  /**
   * Send Discord webhook notification for error and critical logs
   */
  private sendDiscordNotificationIfNeeded(logEntry: PM2LogEntry): void {
    // Only send notifications for error and critical level logs
    if (logEntry.level !== 'error' && logEntry.level !== 'critical') {
      return;
    }

    // Check if Discord webhook is configured
    if (!discordWebhookService.isConfigured()) {
      return;
    }

    // Send notification asynchronously to avoid blocking log processing
    this.sendDiscordNotification(logEntry).catch(error => {
      console.error('Failed to send Discord notification for PM2 log:', error);
    });
  }

  /**
   * Send Discord webhook notification for a log entry
   */
  private async sendDiscordNotification(logEntry: PM2LogEntry): Promise<void> {
    try {
      const title = logEntry.level === 'critical' ? '🚨 Critical PM2 Error' : '❌ PM2 Error Detected';
      const description = `A ${logEntry.level} level error occurred in the modl-panel PM2 instance`;

      const fields = [
        {
          name: 'Error Message',
          value: logEntry.message.length > 1000 ?
            `${logEntry.message.substring(0, 1000)}...` :
            logEntry.message,
          inline: false
        },
        {
          name: 'Source',
          value: logEntry.source,
          inline: true
        },
        {
          name: 'Category',
          value: logEntry.category || 'pm2',
          inline: true
        },
        {
          name: 'Timestamp',
          value: logEntry.timestamp.toISOString(),
          inline: true
        }
      ];

      // Add metadata if available
      if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
        const metadataString = JSON.stringify(logEntry.metadata, null, 2);
        fields.push({
          name: 'Metadata',
          value: metadataString.length > 500 ?
            `\`\`\`json\n${metadataString.substring(0, 500)}...\n\`\`\`` :
            `\`\`\`json\n${metadataString}\n\`\`\``,
          inline: false
        });
      }

      await discordWebhookService.sendNotification(
        NotificationType.ERROR,
        title,
        description,
        fields
      );
    } catch (error) {
      console.error('Error sending Discord notification for PM2 log:', error);
    }
  }

  /**
   * Enable PM2 log streaming
   */
  enable(): void {
    this.isEnabled = true;
    console.log('PM2 log streaming enabled');
  }

  /**
   * Disable PM2 log streaming
   */
  disable(): void {
    console.log('PM2LogService.disable() called');
    this.isEnabled = false;
    if (this.isStreaming) {
      console.log('Stopping PM2 streaming as part of disable');
      this.stopStreaming();
    }
    console.log('PM2 log streaming disabled');
  }

  /**
   * Get the current streaming status
   */
  getStatus(): { isEnabled: boolean; isStreaming: boolean; reconnectAttempts: number } {
    return {
      isEnabled: this.isEnabled,
      isStreaming: this.isStreaming,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Get recent PM2 logs from database
   */
  async getRecentLogs(limit = 100): Promise<any[]> {
    try {
      const SystemLogModel = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema);

      const logs = await SystemLogModel
        .find({ source: 'modl-panel' })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error) {
      console.error('Failed to fetch recent PM2 logs:', error);
      return [];
    }
  }

  /**
   * Test method to simulate processing a log entry (for testing Discord webhook integration)
   */
  testLogEntry(logEntry: PM2LogEntry): void {
    try {
      // Save to database
      this.saveLogToDatabase(logEntry);

      // Emit for real-time updates
      this.emit('newLog', logEntry);

      // Send Discord webhook notification for error and critical logs
      this.sendDiscordNotificationIfNeeded(logEntry);

      console.log(`Test log entry processed: ${logEntry.level} - ${logEntry.message}`);
    } catch (error) {
      console.error('Error processing test log entry:', error);
    }
  }
}

export default new PM2LogService(); 