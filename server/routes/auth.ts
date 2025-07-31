import { Router, Request, Response } from 'express';
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import EmailService from '../services/EmailService';
import { requireAuth } from '../middleware/authMiddleware';
import { loginRateLimit, codeRequestRateLimit } from '../middleware/rateLimitMiddleware';

// Define IAdminUser directly in this file
interface IAdminUser extends Document {
  email: string;
  loggedInIps: string[];
  lastActivityAt: Date;
  createdAt: Date;
}

// Define AdminUserSchema directly in this file
const AdminUserSchema = new Schema<IAdminUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  loggedInIps: [{ type: String, trim: true }],
  lastActivityAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false,
  collection: 'admin_users'
});

const getAdminUserModel = (): Model<IAdminUser> => {
  return mongoose.models.AdminUser as Model<IAdminUser> || mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
};

const router = Router();

/**
 * POST /api/auth/request-code
 * Request verification code for admin email
 */
router.post('/request-code', codeRequestRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if admin exists
    const AdminUserModel = getAdminUserModel();
    const admin = await AdminUserModel.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    // Send verification code
    await EmailService.sendVerificationCode(email);

    return res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Request code error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and verification code
 */
router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required'
      });
    }

    // Check if admin exists
    const AdminUserModel = getAdminUserModel();
    const admin = await AdminUserModel.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify code
    const isValidCode = await EmailService.verifyCode(email, code);
    if (!isValidCode) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired code'
      });
    }

    // Get client IP
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Update admin record
    admin.lastActivityAt = new Date();
    if (!admin.loggedInIps.includes(clientIP)) {
      admin.loggedInIps.push(clientIP);
    }
    await admin.save();

    // Create session
    // @ts-ignore
    req.session.adminId = admin.id;
    // @ts-ignore
    req.session.email = admin.email;
    // @ts-ignore
    req.session.isAuthenticated = true;

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        email: admin.email,
        lastActivityAt: admin.lastActivityAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout admin
 */
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
    
    res.clearCookie('modl.admin.sid');
    return res.json({
      success: true,
      message: 'Logout successful'
    });
  });
});

/**
 * GET /api/auth/session
 * Get current session info
 */
router.get('/session', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    return res.json({
      success: true,
      data: {
        email: req.adminUser.email,
        lastActivityAt: req.adminUser.lastActivityAt,
        loggedInIps: req.adminUser.loggedInIps,
        isAuthenticated: true
      }
    });
  } catch (error) {
    console.error('Session check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Session check failed'
    });
  }
});

export default router; 