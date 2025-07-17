import { Router, Request, Response } from 'express';
import mongoose, { Schema, model, Document, Model, PipelineStage } from 'mongoose';
import { ISystemLog as ISystemLogShared, IModlServer as IModlServerShared, ApiResponse, ModlServerSchema, SystemLogSchema } from 'modl-shared-web';
import { requireAuth } from '../middleware/authMiddleware';
import PM2LogService from '../services/PM2LogService';

type ISystemLog = ISystemLogShared & Document;
type IModlServer = IModlServerShared & Document;

const router = Router();

const getSystemLogModel = (): Model<ISystemLog> => {
  return mongoose.models.SystemLog as Model<ISystemLog> || mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
}

const getModlServerModel = (): Model<IModlServer> => {
  return mongoose.models.ModlServer as Model<IModlServer> || mongoose.model<IModlServer>('ModlServer', ModlServerSchema);
}

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/monitoring/dashboard
 * Get dashboard metrics and overview data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get server counts
    const ModlServerModel = getModlServerModel();
    const [
      totalServers,
      activeServers,
      pendingServers,
      failedServers
    ] = await Promise.all([
      ModlServerModel.countDocuments(),
      ModlServerModel.countDocuments({ 
        provisioningStatus: 'completed', 
        emailVerified: true 
      }),
      ModlServerModel.countDocuments({ 
        provisioningStatus: { $in: ['pending', 'in-progress'] } 
      }),
      ModlServerModel.countDocuments({ 
        provisioningStatus: 'failed' 
      })
    ]);

    // Get log counts by level for the last 24 hours
    const SystemLogModel = getSystemLogModel();
    const [
      criticalLogs24h,
      errorLogs24h,
      warningLogs24h,
      totalLogs24h,
      unresolvedCritical,
      unresolvedErrors
    ] = await Promise.all([
      SystemLogModel.countDocuments({ 
        level: 'critical', 
        timestamp: { $gte: oneDayAgo } 
      }),
      SystemLogModel.countDocuments({ 
        level: 'error', 
        timestamp: { $gte: oneDayAgo } 
      }),
      SystemLogModel.countDocuments({ 
        level: 'warning', 
        timestamp: { $gte: oneDayAgo } 
      }),
      SystemLogModel.countDocuments({ 
        timestamp: { $gte: oneDayAgo } 
      }),
      SystemLogModel.countDocuments({ 
        level: 'critical', 
        resolved: false 
      }),
      SystemLogModel.countDocuments({ 
        level: 'error', 
        resolved: false 
      })
    ]);

    // Get recent server registrations (last 7 days)
    const recentServers = await ModlServerModel.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });

    // Calculate system health score
    const healthScore = calculateSystemHealth({
      totalServers,
      activeServers,
      failedServers,
      criticalLogs24h,
      errorLogs24h,
      unresolvedCritical,
      unresolvedErrors
    });

    // Get log trend data for the last 7 days
    const logTrends = await getLogTrends(oneWeekAgo, now);

    const response: ApiResponse = {
      success: true,
      data: {
        servers: {
          total: totalServers,
          active: activeServers,
          pending: pendingServers,
          failed: failedServers,
          recentRegistrations: recentServers
        },
        logs: {
          last24h: {
            total: totalLogs24h,
            critical: criticalLogs24h,
            error: errorLogs24h,
            warning: warningLogs24h
          },
          unresolved: {
            critical: unresolvedCritical,
            error: unresolvedErrors
          }
        },
        systemHealth: {
          score: healthScore,
          status: healthScore >= 95 ? 'excellent' : 
                  healthScore >= 85 ? 'good' : 
                  healthScore >= 70 ? 'fair' : 'poor'
        },
        trends: logTrends,
        lastUpdated: now
      }
    };

    return res.json(response);
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard metrics'
    });
  }
});

/**
 * GET /api/monitoring/logs
 * Get system logs with filtering and pagination
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      level,
      source,
      serverId,
      category,
      resolved,
      search,
      startDate,
      endDate,
      sort = 'timestamp',
      order = 'desc'
    } = req.query;

    const SystemLogModel = getSystemLogModel();
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter: any = {};
    
    if (level) {
      filter.level = level;
    }
    
    if (source) {
      filter.source = source;
    }
    
    if (serverId) {
      filter.serverId = serverId;
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (resolved !== undefined) {
      filter.resolved = resolved === 'true';
    }
    
    if (search) {
      filter.$text = { $search: search as string };
    }
    
    // Date range filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate as string);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate as string);
      }
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    // Execute queries
    const [logs, total] = await Promise.all([
      SystemLogModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SystemLogModel.countDocuments(filter)
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        filters: {
          level,
          source,
          serverId,
          category,
          resolved,
          search,
          startDate,
          endDate
        }
      }
    };

    return res.json(response);
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch logs'
    });
  }
});

/**
 * POST /api/monitoring/logs
 * Create a new system log entry
 */
router.post('/logs', async (req: Request, res: Response) => {
  try {
    const logData = req.body;
    
    // Validate required fields
    if (!logData.level || !logData.message || !logData.source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: level, message, source'
      });
    }

    const SystemLogModel = getSystemLogModel();
    const log = new SystemLogModel({
      ...logData,
      timestamp: new Date()
    });
    
    await log.save();

    return res.status(201).json({
      success: true,
      data: log,
      message: 'Log entry created successfully'
    });
  } catch (error) {
    console.error('Create log error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create log entry'
    });
  }
});

/**
 * GET /api/monitoring/sources
 * Get available log sources for filtering
 */
router.get('/sources', async (req: Request, res: Response) => {
  try {
    const SystemLogModel = getSystemLogModel();
    const sources = await SystemLogModel.distinct('source');
    const categories = await SystemLogModel.distinct('category');
    
    return res.json({
      success: true,
      data: {
        sources: sources.filter(Boolean),
        categories: categories.filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Get sources error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sources'
    });
  }
});

/**
 * PUT /api/monitoring/logs/:id/resolve
 * Mark a log entry as resolved
 */
router.put('/logs/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolvedBy } = req.body;
    
    const SystemLogModel = getSystemLogModel();
    const log = await SystemLogModel.findByIdAndUpdate(
      id,
      {
        resolved: true,
        resolvedBy: resolvedBy || 'admin',
        resolvedAt: new Date()
      },
      { new: true }
    );

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log entry not found'
      });
    }

    return res.json({
      success: true,
      data: log,
      message: 'Log entry marked as resolved'
    });
  } catch (error) {
    console.error('Resolve log error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve log entry'
    });
  }
});

/**
 * GET /api/monitoring/health
 * Real-time system health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { checks, overallStatus } = await performHealthChecks();
    
    return res.json({
      success: true,
      data: {
        status: overallStatus,
        checks,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/monitoring/pm2-status
 * Get PM2 log streaming status
 */
router.get('/pm2-status', async (req: Request, res: Response) => {
  try {
    const status = PM2LogService.getStatus();
    const recentLogs = await PM2LogService.getRecentLogs(10);
    
    console.log('PM2 status endpoint called, returning:', {
      ...status,
      recentLogsCount: recentLogs.length
    });
    
    // Set no-cache headers to prevent caching issues
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.json({
      success: true,
      data: {
        ...status,
        recentLogsCount: recentLogs.length,
        lastLogTime: recentLogs.length > 0 ? recentLogs[0].timestamp : null
      }
    });
  } catch (error) {
    console.error('PM2 status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get PM2 status'
    });
  }
});

/**
 * POST /api/monitoring/pm2/restart
 * Restart PM2 log streaming
 */
router.post('/pm2/restart', async (req: Request, res: Response) => {
  try {
    PM2LogService.stopStreaming();
    
    // Wait a moment before restarting
    setTimeout(() => {
      PM2LogService.startStreaming();
    }, 1000);
    
    return res.json({
      success: true,
      message: 'PM2 log streaming restarted'
    });
  } catch (error) {
    console.error('PM2 restart error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to restart PM2 log streaming'
    });
  }
});

/**
 * POST /api/monitoring/pm2/toggle
 * Toggle PM2 log streaming on/off
 */
router.post('/pm2/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (enabled) {
      PM2LogService.enable();
      PM2LogService.startStreaming();
    } else {
      PM2LogService.disable();
    }
    
    const status = PM2LogService.getStatus();
    
    return res.json({
      success: true,
      data: status,
      message: `PM2 log streaming ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('PM2 toggle error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle PM2 log streaming'
    });
  }
});

/**
 * POST /api/monitoring/logs/delete
 * Delete specific logs by IDs
 */
router.post('/logs/delete', async (req: Request, res: Response) => {
  try {
    const { logIds } = req.body;
    
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Log IDs are required'
      });
    }

    const SystemLogModel = getSystemLogModel();
    const result = await SystemLogModel.deleteMany({
      _id: { $in: logIds }
    });

    return res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      },
      message: `Successfully deleted ${result.deletedCount} log(s)`
    });
  } catch (error) {
    console.error('Delete logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete logs'
    });
  }
});

/**
 * GET /api/monitoring/logs/export
 * Export logs as CSV
 */
router.get('/logs/export', async (req: Request, res: Response) => {
  try {
    const {
      level,
      source,
      category,
      resolved,
      search,
      startDate,
      endDate
    } = req.query;

    // Build filter object (same as in logs endpoint)
    const filter: any = {};
    if (level && level !== 'all') filter.level = level;
    if (source && source !== 'all') filter.source = source;
    if (category && category !== 'all') filter.category = category;
    if (resolved && resolved !== 'all') filter.resolved = resolved === 'true';
    if (search) filter.message = { $regex: search as string, $options: 'i' };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate as string);
      if (endDate) filter.timestamp.$lte = new Date(endDate as string);
    }

    const SystemLogModel = getSystemLogModel();
    const logs = await SystemLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(10000) // Limit to prevent memory issues
      .lean();

    // Convert to CSV
    const csvHeader = 'Timestamp,Level,Source,Category,Message,Resolved,Resolved By\n';
    const csvRows = logs.map((log: any) => {
      const timestamp = new Date(log.timestamp).toISOString();
      const level = log.level || '';
      const source = log.source || '';
      const category = log.category || '';
      const message = (log.message || '').replace(/"/g, '""'); // Escape quotes
      const resolved = log.resolved ? 'Yes' : 'No';
      const resolvedBy = log.resolvedBy || '';
      
      return `"${timestamp}","${level}","${source}","${category}","${message}","${resolved}","${resolvedBy}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    
    return res.send(csvContent);
  } catch (error) {
    console.error('Export logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export logs'
    });
  }
});

/**
 * POST /api/monitoring/logs/clear-all
 * Clear all system logs
 */
router.post('/logs/clear-all', async (req: Request, res: Response) => {
  try {
    const SystemLogModel = getSystemLogModel();
    const result = await SystemLogModel.deleteMany({});

    // Log this critical action
    console.log(`All system logs cleared by admin: ${(req as any).session?.email || 'unknown'}`);

    return res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      },
      message: `Successfully cleared all logs (${result.deletedCount} entries deleted)`
    });
  } catch (error) {
    console.error('Clear all logs error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear logs'
    });
  }
});

interface HealthCheckItem {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  message: string;
  responseTime?: number;
  count?: number;
  error?: string;
}

// Helper functions

function calculateSystemHealth(metrics: {
  totalServers: number;
  activeServers: number;
  failedServers: number;
  criticalLogs24h: number;
  errorLogs24h: number;
  unresolvedCritical: number;
  unresolvedErrors: number;
}): number {
  let score = 100;
  
  // Penalize for failed servers
  if (metrics.totalServers > 0) {
    const failureRate = metrics.failedServers / metrics.totalServers;
    score -= failureRate * 30;
  }
  
  // Penalize for critical logs
  score -= Math.min(metrics.criticalLogs24h * 5, 25);
  score -= Math.min(metrics.errorLogs24h * 1, 20);
  
  // Heavy penalty for unresolved critical issues
  score -= metrics.unresolvedCritical * 10;
  score -= metrics.unresolvedErrors * 3;
  
  return Math.max(0, Math.round(score));
}

async function getLogTrends(startDate: Date, endDate: Date) {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          level: "$level"
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: "$_id.date",
        levels: {
          $push: {
            level: "$_id.level",
            count: "$count"
          }
        },
        total: { $sum: "$count" }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ];

  return await getSystemLogModel().aggregate(pipeline);
}

async function performHealthChecks() {
  const checks: HealthCheckItem[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

  const checkAndPush = (result: HealthCheckItem) => {
    checks.push(result);
    if (result.status === 'critical') {
      overallStatus = 'critical';
    } else if (result.status === 'degraded' && overallStatus !== 'critical') {
      overallStatus = 'degraded';
    }
  };
  
  // Database connectivity check
  try {
    if (!mongoose.connection.db) {
      throw new Error('Database connection not available');
    }
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    const responseTime = Date.now() - startTime;
    checkAndPush({
      name: 'Database Connectivity',
      status: 'healthy',
      message: 'MongoDB connection is responsive.',
      responseTime
    });
  } catch (error: any) {
    checkAndPush({
      name: 'Database Connectivity',
      status: 'critical',
      message: 'Failed to ping MongoDB.',
      error: error.message
    });
  }

  // Check for unresolved critical errors
  try {
    const SystemLogModel = getSystemLogModel();
    const criticalLogsCount = await SystemLogModel.countDocuments({
      level: 'critical',
      resolved: false,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
    });

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalLogsCount > 5) status = 'critical';
    else if (criticalLogsCount > 0) status = 'degraded';

    checkAndPush({
      name: 'Critical System Logs',
      status: status,
      message: `${criticalLogsCount} unresolved critical log(s) in the last 24 hours.`,
      count: criticalLogsCount,
    });
  } catch (error: any) {
    checkAndPush({
      name: 'Critical System Logs',
      status: 'unknown',
      message: 'Could not check system logs.',
      error: error.message
    });
  }
  
  // Check for servers that failed to provision
  try {
    const ModlServerModel = getModlServerModel();
    const failedServerCount = await ModlServerModel.countDocuments({
      provisioningStatus: 'failed'
    });
    
    let status: 'healthy' | 'degraded' = 'healthy';
    if (failedServerCount > 0) status = 'degraded';
    
    checkAndPush({
        name: 'Server Provisioning',
        status: status,
        message: `${failedServerCount} server(s) failed to provision.`,
        count: failedServerCount,
    });
  } catch (error: any) {
     checkAndPush({
        name: 'Server Provisioning',
        status: 'unknown',
        message: 'Could not check server provisioning status.',
        error: error.message
    });
  }

  // Check PM2 log streaming status
  try {
    const pm2Status = PM2LogService.getStatus();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    let message = 'PM2 log streaming is active and healthy.';
    
    if (!pm2Status.isEnabled) {
      status = 'healthy';
      message = 'PM2 log streaming is disabled by configuration.';
    } else if (!pm2Status.isStreaming) {
      status = 'critical';
      message = 'PM2 log streaming is enabled but not active.';
    } else if (pm2Status.reconnectAttempts > 0) {
      status = 'degraded';
      message = `PM2 log streaming is active but had ${pm2Status.reconnectAttempts} reconnect attempts.`;
    }
    
    checkAndPush({
      name: 'PM2 Log Streaming',
      status: status,
      message: message,
      count: pm2Status.reconnectAttempts
    });
  } catch (error: any) {
    checkAndPush({
      name: 'PM2 Log Streaming',
      status: 'unknown',
      message: 'Could not check PM2 log streaming status.',
      error: error.message
    });
  }
  
  return { checks, overallStatus };
}

export default router; 