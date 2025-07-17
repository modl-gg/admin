import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { ISystemConfig as ISystemConfigShared, SystemConfigSchema } from 'modl-shared-web';
import { requireAuth } from '../middleware/authMiddleware';
import { logAuditEvent } from './security';
import PM2LogService from '../services/PM2LogService';

type ISystemConfig = ISystemConfigShared & Document;

const router = Router();

const getSystemConfigModel = (): Model<ISystemConfig> => {
    return mongoose.models.SystemConfig || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
};

// Apply authentication to all system routes
router.use(requireAuth);

// Default configuration, used if no config is found in the DB
const defaultConfig = {
  general: {
    systemName: 'modl Admin',
    adminEmail: 'admin@modl.gg',
    timezone: 'UTC',
    defaultLanguage: 'en',
    maintenanceMode: false,
    maintenanceMessage: 'System under maintenance. Please check back later.'
  },
  logging: {
    pm2LoggingEnabled: process.env.PM2_LOGGING_ENABLED !== 'false',
    logRetentionDays: 30,
    maxLogSizePerDay: 1000000 // 1MB
  },
  security: {
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    requireTwoFactor: false,
    passwordMinLength: 8,
    passwordRequireSpecial: false,
    ipWhitelist: [],
    corsOrigins: ['https://admin.modl.gg']
  },
  notifications: {
    emailNotifications: true,
    criticalAlerts: true,
    weeklyReports: true,
    maintenanceAlerts: true,
    slackWebhook: '',
    discordWebhook: ''
  },
  performance: {
    cacheTtl: 300,
    rateLimitRequests: 100,
    rateLimitWindow: 60,
    databaseConnectionPool: 10,
    enableCompression: true,
    enableCaching: true
  },
  features: {
    analyticsEnabled: true,
    auditLoggingEnabled: true,
    apiAccessEnabled: true,
    bulkOperationsEnabled: true,
    advancedFiltering: true,
    realTimeUpdates: true
  }
};

// Helper to get or create the main config
export async function getMainConfig(): Promise<ISystemConfig> {
  const SystemConfigModel = getSystemConfigModel();
  
  // First try to find existing config
  let config = await SystemConfigModel.findOne({ configId: 'main_config' });
  
  if (!config) {
    // Create new config with defaults if none exists
    config = await SystemConfigModel.create({
      configId: 'main_config',
      ...defaultConfig
    });
  } else {
    // Ensure existing config has all required sections with defaults
    let needsUpdate = false;
    const updates: any = {};
    
    // Check if logging section exists, if not add it
    if (!config.logging) {
      updates.logging = defaultConfig.logging;
      needsUpdate = true;
    }
    
    // Add other sections if missing
    Object.keys(defaultConfig).forEach(key => {
      if (key !== 'logging' && config && !config[key as keyof ISystemConfig]) {
        updates[key] = defaultConfig[key as keyof typeof defaultConfig];
        needsUpdate = true;
      }
    });
    
    // Update config if needed
    if (needsUpdate) {
      config = await SystemConfigModel.findOneAndUpdate(
        { configId: 'main_config' },
        { $set: updates },
        { new: true, runValidators: true }
      );
    }
  }
  
  return config!;
}

// Rate limiting configuration
const configRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Increased limit for config changes
  message: { error: 'Too many configuration changes' }
});

// Configuration validation schema
const configSchema = z.object({
  general: z.object({
    systemName: z.string().min(1).max(100),
    adminEmail: z.string().email(),
    timezone: z.string(),
    defaultLanguage: z.string(),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string()
  }),
  logging: z.object({
    pm2LoggingEnabled: z.boolean(),
    logRetentionDays: z.number().min(1).max(365),
    maxLogSizePerDay: z.number().min(1000).max(100000000) // 1KB to 100MB
  }),
  security: z.object({
    sessionTimeout: z.number().min(5).max(1440),
    maxLoginAttempts: z.number().min(1).max(10),
    lockoutDuration: z.number().min(1).max(60),
    requireTwoFactor: z.boolean(),
    passwordMinLength: z.number().min(6).max(32),
    passwordRequireSpecial: z.boolean(),
    ipWhitelist: z.array(z.string()),
    corsOrigins: z.array(z.string())
  }),
  notifications: z.object({
    emailNotifications: z.boolean(),
    criticalAlerts: z.boolean(),
    weeklyReports: z.boolean(),
    maintenanceAlerts: z.boolean(),
    slackWebhook: z.string().optional(),
    discordWebhook: z.string().optional()
  }),
  performance: z.object({
    cacheTtl: z.number().min(60).max(3600),
    rateLimitRequests: z.number().min(10).max(1000),
    rateLimitWindow: z.number().min(10).max(300),
    databaseConnectionPool: z.number().min(5).max(50),
    enableCompression: z.boolean(),
    enableCaching: z.boolean()
  }),
  features: z.object({
    analyticsEnabled: z.boolean(),
    auditLoggingEnabled: z.boolean(),
    apiAccessEnabled: z.boolean(),
    bulkOperationsEnabled: z.boolean(),
    advancedFiltering: z.boolean(),
    realTimeUpdates: z.boolean()
  })
});

// Get system configuration
router.get('/config', async (req, res) => {
  try {
    const config = await getMainConfig();
    return res.json({
      success: true,
      data: config.toObject()
    });
  } catch (error) {
    console.error('Get config error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch configuration' 
    });
  }
});

// Update system configuration
router.put('/config', configRateLimit, async (req, res) => {
  try {
    const validatedConfig = configSchema.parse(req.body);
    
    // Get current config to check for PM2 logging changes
    const currentConfig = await getMainConfig();
    const currentPM2Enabled = currentConfig.logging?.pm2LoggingEnabled ?? true;
    const newPM2Enabled = validatedConfig.logging.pm2LoggingEnabled;
    
    const SystemConfigModel = getSystemConfigModel();
    const updatedConfig = await SystemConfigModel.findOneAndUpdate(
      { configId: 'main_config' },
      { $set: validatedConfig },
      { new: true, upsert: true }
    );
    
    // Handle PM2 logging state changes
    console.log(`PM2 config change check: current=${currentPM2Enabled}, new=${newPM2Enabled}`);
    if (currentPM2Enabled !== newPM2Enabled) {
      if (newPM2Enabled) {
        PM2LogService.enable();
        PM2LogService.startStreaming();
        console.log('PM2 logging enabled via configuration');
      } else {
        PM2LogService.disable();
        console.log('PM2 logging disabled via configuration');
        // Double check the service is actually disabled
        const status = PM2LogService.getStatus();
        console.log('PM2 service status after disable:', status);
      }
    } else {
      console.log('No PM2 configuration change detected');
    }
    
    // @ts-ignore
    console.log(`Configuration updated by admin: ${req.session.email}`);
    
    return res.json({
      success: true,
      data: updatedConfig,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        details: error.errors
      });
    } else {
      console.error('Update config error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update configuration'
      });
    }
  }
});

// Get maintenance status
router.get('/maintenance', async (req, res) => {
  try {
    const config = await getMainConfig();
    return res.json({
      success: true,
      data: {
        isActive: config.general.maintenanceMode,
        message: config.general.maintenanceMessage,
      }
    });
  } catch (error) {
    console.error('Get maintenance status error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch maintenance status' 
    });
  }
});

// Toggle maintenance mode
router.post('/maintenance/toggle', async (req, res) => {
  try {
    const { enabled, message } = req.body;
    
    const update: any = {
      'general.maintenanceMode': enabled
    };

    if (message) {
      update['general.maintenanceMessage'] = message;
    }

    const SystemConfigModel = getSystemConfigModel();
    const updatedConfig = await SystemConfigModel.findOneAndUpdate(
        { configId: 'main_config' },
        { $set: update },
        { new: true, upsert: true }
    );
    
    // @ts-ignore
    console.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin: ${req.session.email}`);
    
    return res.json({
      success: true,
      data: {
        isActive: updatedConfig.general.maintenanceMode,
        message: updatedConfig.general.maintenanceMessage,
      },
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Toggle maintenance error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle maintenance mode'
    });
  }
});

// Get rate limit status
router.get('/rate-limits', async (req, res) => {
  try {
    const config = await getMainConfig();
    return res.json({
      success: true,
      data: {
        current: config.performance,
        active: true,
        resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('Get rate limits error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch rate limit status' 
    });
  }
});

// Update rate limits
router.put('/rate-limits', configRateLimit, async (req, res) => {
  try {
    const { rateLimitRequests, rateLimitWindow } = req.body;
    
    const update: any = {};
    if (rateLimitRequests) {
      update['performance.rateLimitRequests'] = rateLimitRequests;
    }
    if (rateLimitWindow) {
      update['performance.rateLimitWindow'] = rateLimitWindow;
    }

    const SystemConfigModel = getSystemConfigModel();
    const config = await SystemConfigModel.findOneAndUpdate(
      { configId: 'main_config' },
      { $set: update },
      { new: true, upsert: true }
    );
    
    // @ts-ignore
    console.log(`Rate limits updated by admin: ${req.session.email}`);
    
    return res.json({
      success: true,
      data: config.performance,
      message: 'Rate limits updated successfully'
    });
  } catch (error) {
    console.error('Update rate limits error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update rate limits'
    });
  }
});

// System Prompts Management Routes
interface ISystemPrompt extends Document {
  strictnessLevel: 'lenient' | 'standard' | 'strict';
  prompt: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SystemPromptSchema = new Schema<ISystemPrompt>({
  strictnessLevel: {
    type: String,
    enum: ['lenient', 'standard', 'strict'],
    required: true,
    unique: true
  },
  prompt: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const getSystemPromptModel = (): Model<ISystemPrompt> => {
  return mongoose.models.SystemPrompt || mongoose.model<ISystemPrompt>('SystemPrompt', SystemPromptSchema);
};

// Get all system prompts
router.get('/prompts', requireAuth, async (req: Request, res: Response) => {
  try {
    const SystemPrompt = getSystemPromptModel();
    const prompts = await SystemPrompt.find({}).sort({ strictnessLevel: 1 });
    
    res.json({
      success: true,
      data: prompts
    });
  } catch (error: any) {
    console.error('Error fetching system prompts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system prompts',
      message: error.message
    });
  }
});

// Update a system prompt
// @ts-ignore
router.put('/prompts/:strictnessLevel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { strictnessLevel } = req.params;
    const { prompt } = req.body;

    // Validate strictness level
    if (!['lenient', 'standard', 'strict'].includes(strictnessLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strictness level. Must be lenient, standard, or strict.'
      });
    }

    // Validate prompt content
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt content is required and must be a non-empty string.'
      });
    }

    const SystemPrompt = getSystemPromptModel();
    
    // Update or create the prompt
    const updatedPrompt = await SystemPrompt.findOneAndUpdate(
      { strictnessLevel },
      { 
        prompt: prompt.trim(),
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Log the admin action
    await logAuditEvent({
      // @ts-ignore
      adminId: req.session?.adminId || 'system',
      action: 'update_system_prompt',
      resource: `system_prompt_${strictnessLevel}`,
      details: {
        strictnessLevel,
        promptLength: prompt.length,
        previousPromptId: updatedPrompt._id
      },
      severity: 'medium',
      success: true,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: updatedPrompt,
      message: `System prompt for ${strictnessLevel} level updated successfully`
    });
  } catch (error: any) {
    console.error('Error updating system prompt:', error);
    
    // Log the failed attempt
    await logAuditEvent({
      // @ts-ignore
      adminId: req.session?.adminId || 'system',
      action: 'update_system_prompt',
      resource: `system_prompt_${req.params.strictnessLevel}`,
      details: {
        error: error.message,
        strictnessLevel: req.params.strictnessLevel
      },
      severity: 'high',
      success: false,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update system prompt',
      message: error.message
    });
  }
});

// Reset a system prompt to default
// @ts-ignore
router.post('/prompts/:strictnessLevel/reset', requireAuth, async (req: Request, res: Response) => {
  try {
    const { strictnessLevel } = req.params;

    // Validate strictness level
    if (!['lenient', 'standard', 'strict'].includes(strictnessLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strictness level. Must be lenient, standard, or strict.'
      });
    }

    // Get default prompt (this would need to be implemented similar to the modl-panel service)
    const defaultPrompt = getDefaultPromptForLevel(strictnessLevel as 'lenient' | 'standard' | 'strict');

    const SystemPrompt = getSystemPromptModel();
    
    // Reset to default prompt
    const resetPrompt = await SystemPrompt.findOneAndUpdate(
      { strictnessLevel },
      { 
        prompt: defaultPrompt,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    // Log the admin action
    await logAuditEvent({
      // @ts-ignore
      adminId: req.session?.adminId || 'system',
      action: 'reset_system_prompt',
      resource: `system_prompt_${strictnessLevel}`,
      details: {
        strictnessLevel,
        resetToDefault: true
      },
      severity: 'medium',
      success: true,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: resetPrompt,
      message: `System prompt for ${strictnessLevel} level reset to default`
    });
  } catch (error: any) {
    console.error('Error resetting system prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset system prompt',
      message: error.message
    });
  }
});

// Helper function to get default prompts (updated to match modl-panel service)
function getDefaultPromptForLevel(strictnessLevel: 'lenient' | 'standard' | 'strict'): string {
  const jsonFormat = `{{JSON_FORMAT}}`;
  const punishmentTypesList = `{{PUNISHMENT_TYPES_LIST}}`;

  const commonInstructions = `You are an AI moderator analyzing Minecraft server chat logs for rule violations. Analyze the provided chat transcript and determine if any moderation action is needed.

**AVAILABLE PUNISHMENT TYPES:**
${punishmentTypesList}

**RESPONSE FORMAT:**
You must respond with a valid JSON object in this exact format:
${jsonFormat}

**PUNISHMENT SEVERITY GUIDELINES:**
- **"low"**: Minor infractions, first-time offenses, borderline cases, mild language
- **"regular"**: Clear rule violations, repeat minor offenses, moderate disruption
- **"severe"**: Serious violations, multiple rule breaks, toxic behavior, threats

**GENERAL GUIDELINES:**
- Always consider context and intent behind messages
- Look for patterns of behavior, not just isolated incidents
- Consider the impact on other players and server community
- Use the AI descriptions provided for each punishment type to guide your decisions
- Only suggest action when rules are clearly violated
- If no violation is found, return null for suggestedAction`;

  const strictnessPrompts = {
    lenient: `${commonInstructions}

**LENIENT MODE - Additional Guidelines:**
- Give players significant benefit of the doubt when context is unclear
- Only suggest action for clear, obvious rule violations
- Prefer warnings and lighter punishments for first-time offenses
- Consider friendly banter and casual conversation as acceptable
- Be very forgiving of minor language issues and typos
- Focus on patterns of behavior rather than isolated incidents
- Require strong evidence before suggesting moderation action
- When in doubt about intent, assume positive intent

**Decision Threshold:** Only take action when violations are unambiguous and clearly harmful.`,

    standard: `${commonInstructions}

**STANDARD MODE - Additional Guidelines:**
- Apply consistent moderation based on community standards
- Consider the severity and impact of violations on the community
- Balance individual player behavior with overall server atmosphere
- Escalate punishment severity for repeat offenses when evident
- Take context into account but enforce rules fairly and consistently
- Focus on maintaining a positive gaming environment for all players
- Use judgment for edge cases while maintaining consistent standards
- Consider both explicit violations and implicit harmful behavior

**Decision Threshold:** Apply appropriate action when rules are clearly violated, using balanced judgment for borderline cases.`,

    strict: `${commonInstructions}

**STRICT MODE - Additional Guidelines:**
- Enforce rules rigorously with minimal tolerance for violations
- Take action on borderline cases that could negatively impact community
- Prefer higher severity punishments to maintain strict server standards
- Consider even minor infractions as worthy of moderation review
- Prioritize community safety and positive environment over individual leniency
- Be proactive in preventing escalation of any problematic behavior
- Maintain high standards for acceptable communication and conduct
- Focus on preventing issues before they escalate

**Decision Threshold:** When in doubt, err on the side of taking moderation action to maintain exceptionally high community standards.`
  };

  return strictnessPrompts[strictnessLevel];
}

export default router; 