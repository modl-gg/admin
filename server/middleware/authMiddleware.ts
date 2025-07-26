import { Request, Response, NextFunction } from 'express';
import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { IAdminUser, AdminUserSchema } from '@modl-gg/shared-web';
import 'dotenv/config';

const getAdminUserModel = (): Model<IAdminUser> => {
  return mongoose.models.AdminUser || model<IAdminUser>('AdminUser', AdminUserSchema);
};

/**
 * Middleware to check if admin is authenticated
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    const mockAdmin = {
      _id: 'dev-admin-id-00000000000000',
      email: 'dev@modl.gg',
      loggedInIps: ['127.0.0.1', '::1', req.ip].filter(Boolean),
      lastActivityAt: new Date(),
      createdAt: new Date(),
    };
    req.adminUser = mockAdmin as any;
    // @ts-ignore
    req.session.adminId = mockAdmin._id;
    // @ts-ignore
    req.session.email = mockAdmin.email;
    // @ts-ignore
    req.session.isAuthenticated = true;
    return next();
  }

  const AdminUserModel = getAdminUserModel();

  try {
    // Check if session exists and has admin ID
    // @ts-ignore
    if (!req.session.adminId || !req.session.isAuthenticated) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify admin still exists in database
    // @ts-ignore
    const admin = await AdminUserModel.findById(req.session.adminId);
    if (!admin) {
      // Clear invalid session
      req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check if current IP is in allowed IPs
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    if (!admin.loggedInIps.includes(clientIP)) {
      return res.status(401).json({
        success: false,
        error: 'IP address not authorized'
      });
    }

    // Attach admin to request
    // @ts-ignore
    req.adminUser = admin;
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication check failed'
    });
  }
};

/**
 * Middleware for optional authentication (doesn't fail if not authenticated)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const AdminUserModel = getAdminUserModel();
  try {
    // @ts-ignore
    if (req.session.adminId && req.session.isAuthenticated) {
      // @ts-ignore
      const admin = await AdminUserModel.findById(req.session.adminId);
      if (admin) {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        if (admin.loggedInIps.includes(clientIP)) {
          // @ts-ignore
          req.adminUser = admin;
        }
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Update admin's last activity and IP if needed
 */
export const updateActivity = async (req: Request, res: Response, next: NextFunction) => {
  const AdminUserModel = getAdminUserModel();
  try {
    // @ts-ignore
    if (req.session.adminId) {
      // @ts-ignore
      if (process.env.NODE_ENV === 'development' && req.session.adminId.startsWith('dev-admin-id')) {
        return next();
      }

      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      // Perform a single update operation
      await AdminUserModel.updateOne(
        // @ts-ignore
        { _id: req.session.adminId },
        {
          $set: { lastActivityAt: new Date() },
          $addToSet: { loggedInIps: clientIP } // Add IP only if it doesn't exist
        }
      );
    }
    return next();
  } catch (error) {
    console.error('Update activity middleware error:', error);
    return next(); // Continue despite error
  }
}; 