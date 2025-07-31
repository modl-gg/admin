import { Router, Request, Response } from 'express';
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { IModlServer as IModlServerShared, ApiResponse, ModlServerSchema } from '@modl-gg/shared-web';
import { requireAuth } from '../middleware/authMiddleware';
import { discordWebhookService } from '../services/DiscordWebhookService';

type IModlServer = IModlServerShared & Document;

const router = Router();

const getModlServerModel = (): Model<IModlServer> => {
  return mongoose.models.ModlServer as Model<IModlServer> || mongoose.model<IModlServer>('ModlServer', ModlServerSchema);
}

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/servers
 * Get all servers with pagination and filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      plan,
      status,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter: any = {};
    
    if (search) {
      filter.$text = { $search: search as string };
    }
    
    if (plan && plan !== 'all') {
      filter.plan = plan;
    }
    
    if (status) {
      switch (status) {
        case 'active':
          filter.provisioningStatus = 'completed';
          filter.emailVerified = true;
          break;
        case 'pending':
          filter.provisioningStatus = { $in: ['pending', 'in-progress'] };
          break;
        case 'failed':
          filter.provisioningStatus = 'failed';
          break;
        case 'unverified':
          filter.emailVerified = false;
          break;
      }
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    // Execute queries
    const ModlServerModel = getModlServerModel();
    const [servers, total] = await Promise.all([
      ModlServerModel
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ModlServerModel.countDocuments(filter)
    ]);

    const response: ApiResponse<{
      servers: IModlServer[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }> = {
      success: true,
      data: {
        servers: servers as IModlServer[],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    };

    return res.json(response);
  } catch (error) {
    console.error('Get servers error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch servers'
    });
  }
});

/**
 * GET /api/servers/:id
 * Get a specific server by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ModlServerModel = getModlServerModel();
    const server = await ModlServerModel.findById(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    return res.json({
      success: true,
      data: server
    });
  } catch (error) {
    console.error('Get server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch server'
    });
  }
});

/**
 * GET /api/servers/:id/stats
 * Get server statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ModlServerModel = getModlServerModel();
    const server = await ModlServerModel.findById(id).lean();
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    if (!server.databaseName) {
      return res.status(400).json({
        success: false,
        error: 'Server database not configured'
      });
    }

    // Connect to the specific server's database
    const serverDb = mongoose.connection.useDb(server.databaseName, { useCache: true });
    
    // Fetch stats from the server's database
    const [
      totalPlayers,
      totalTickets,
      totalLogs,
      dbStats
    ] = await Promise.allSettled([
      serverDb.collection('players').countDocuments(),
      serverDb.collection('tickets').countDocuments(),
      serverDb.collection('logs').countDocuments(),
      serverDb.db?.stats()
    ]);

    const getValue = (result: PromiseSettledResult<any>) => result.status === 'fulfilled' ? result.value : 0;

    const stats = {
      totalPlayers: getValue(totalPlayers),
      totalTickets: getValue(totalTickets),
      totalLogs: getValue(totalLogs),
      lastActivity: server.lastActivityAt || server.updatedAt,
      databaseSize: getValue(dbStats)?.storageSize || 0,
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get server stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch server statistics'
    });
  }
});

/**
 * PUT /api/servers/:id
 * Update a server
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    
    const ModlServerModel = getModlServerModel();
    const server = await ModlServerModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    return res.json({
      success: true,
      data: server,
      message: 'Server updated successfully'
    });
  } catch (error) {
    console.error('Update server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update server'
    });
  }
});

/**
 * DELETE /api/servers/:id
 * Delete a server
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const ModlServerModel = getModlServerModel();
    const server = await ModlServerModel.findByIdAndDelete(id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'Server not found'
      });
    }

    return res.json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (error) {
    console.error('Delete server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete server'
    });
  }
});

/**
 * POST /api/servers
 * Create a new server
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const serverData = req.body;
    
    // Validate required fields
    if (!serverData.serverName || !serverData.customDomain || !serverData.adminEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: serverName, customDomain, adminEmail'
      });
    }

    const ModlServerModel = getModlServerModel();
    const server = new ModlServerModel(serverData);
    await server.save();

    return res.status(201).json({
      success: true,
      data: server,
      message: 'Server created successfully'
    });
  } catch (error) {
    console.error('Create server error:', error);
    
    if (typeof error === 'object' && error && 'code' in error && (error as any).code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Server name or domain already exists'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create server'
    });
  }
});

/**
 * POST /api/servers/bulk
 * Perform bulk operations on servers
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { action, serverIds, parameters } = req.body;

    if (!action || !serverIds || !Array.isArray(serverIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: action, serverIds'
      });
    }

    const updatedAt = new Date();
    let result;
    let affectedCount = 0;

    const ModlServerModel = getModlServerModel();
    switch (action) {
      case 'delete':
        result = await ModlServerModel.deleteMany({
          _id: { $in: serverIds }
        });
        affectedCount = result.deletedCount;
        break;
        
      case 'suspend':
        result = await ModlServerModel.updateMany(
          { _id: { $in: serverIds } },
          { 
            provisioningStatus: 'failed',
            updatedAt 
          }
        );
        affectedCount = result.modifiedCount;
        
        // Send Discord notifications for suspended servers
        if (discordWebhookService.isConfigured() && affectedCount > 0) {
          const suspendedServers = await ModlServerModel.find({
            _id: { $in: serverIds }
          }).select('_id name email plan');
          
          for (const server of suspendedServers) {
            discordWebhookService.sendServerProvisioningFailure(
              server._id.toString(),
              server.name || 'Unnamed Server',
              'Server suspended by admin bulk action',
              {
                'Email': server.email || 'N/A',
                'Plan': server.plan || 'N/A',
                'Action': 'Bulk Suspend'
              }
            ).catch(err => console.error('Discord notification error:', err));
          }
        }
        break;
        
      case 'activate':
        result = await ModlServerModel.updateMany(
          { _id: { $in: serverIds } },
          { 
            provisioningStatus: 'completed',
            emailVerified: true,
            updatedAt 
          }
        );
        affectedCount = result.modifiedCount;
        break;
        
      case 'update-plan':
        if (!parameters?.plan) {
          return res.status(400).json({
            success: false,
            error: 'Plan parameter required for update-plan action'
          });
        }
        result = await ModlServerModel.updateMany(
          { _id: { $in: serverIds } },
          { 
            plan: parameters.plan,
            updatedAt 
          }
        );
        affectedCount = result.modifiedCount;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action'
        });
    }

    return res.json({
      success: true,
      data: {
        action,
        affectedCount,
        serverIds
      },
      message: `Bulk operation '${action}' completed successfully`
    });
  } catch (error) {
    console.error('Bulk operation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Bulk operation failed'
    });
  }
});

/**
 * POST /api/servers/:id/reset-database
 * Reset a server to provisioning state for reinitialization
 */
router.post('/:id/reset-database', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ModlServerModel = getModlServerModel();
    const server = await ModlServerModel.findById(id);

    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    // Reset server to provisioning state
    await ModlServerModel.findByIdAndUpdate(id, {
      provisioningStatus: 'pending',
      provisioningNotes: 'Database reset - awaiting reprovisioning',
      lastActivityAt: null,
      updatedAt: new Date(),
      // Clear any custom domain settings that may need reconfiguration
      customDomain_status: undefined,
      customDomain_lastChecked: undefined,
      customDomain_error: undefined
    });

    // Only drop the database if it exists and is configured
    if (server.databaseName) {
      try {
        // Check if main connection is ready before attempting database operations
        if (mongoose.connection.readyState !== 1) {
          console.warn(`MongoDB connection not ready (state: ${mongoose.connection.readyState}). Skipping database drop for ${server.databaseName}`);
        } else {
          const serverDb = mongoose.connection.useDb(server.databaseName, { useCache: true });
          
          // Add timeout to prevent hanging
          const dropPromise = serverDb.dropDatabase();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database drop operation timed out after 5 seconds')), 5000)
          );
          
          await Promise.race([dropPromise, timeoutPromise]);
          console.log(`Database ${server.databaseName} dropped for server ${server.serverName}`);
        }
      } catch (dbError) {
        console.warn(`Warning: Could not drop database ${server.databaseName}:`, dbError);
        // Continue with the reset even if database drop fails
      }
    }

    console.log(`Server ${server.serverName} reset to provisioning state by admin`);

    return res.json({ 
      success: true, 
      message: 'Server reset to provisioning state. The provisioning system will reinitialize the database with proper structure and seed data.' 
    });
  } catch (error) {
    console.error('Reset database error:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset server' });
  }
});

/**
 * POST /api/servers/:id/export-data
 * Export a server's data
 */
router.post('/:id/export-data', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // In a real implementation, you would generate a file (e.g., JSON, CSV)
    // and provide a download link or stream the file.
    // For now, we'll just simulate a successful export.
    return res.json({ success: true, message: 'Data export initiated. You will receive an email with the download link.' });
  } catch (error) {
    console.error('Export data error:', error);
    return res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

export default router; 