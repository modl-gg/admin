import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import routes
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import monitoringRoutes from './routes/monitoring';
import analyticsRoutes from './routes/analytics';
import systemRoutes from './routes/system';
import securityRoutes from './routes/security';
import { updateActivity } from './middleware/authMiddleware';
import EmailService from './services/EmailService';
import PM2LogService from './services/PM2LogService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Setup Socket.IO for real-time log streaming
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Database connection
async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/modl-global';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for correct IP addresses
app.set('trust proxy', 1);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/modl-global',
    collectionName: 'admin_sessions',
    ttl: 24 * 60 * 60 // 24 hours
  }),
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'modl.admin.sid'
}));

// Global activity tracking middleware
app.use(updateActivity);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected for log streaming:', socket.id);
  
  // Send initial connection confirmation
  socket.emit('connected', { message: 'Connected to log stream' });
  
  // Handle client requesting to start log streaming
  socket.on('startLogStream', () => {
    console.log('Client requested log streaming');
    // Client will receive logs through the PM2LogService event emitter
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from log streaming:', socket.id);
  });
});

// Setup PM2 log streaming
PM2LogService.on('newLog', (logEntry) => {
  // Broadcast new logs to all connected clients
  io.emit('newLog', logEntry);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/audit', securityRoutes);
app.use('/api/security', securityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'modl-admin server is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Serve static files from the client build directory
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (require('fs').existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // For any route that is not an API route, serve the index.html file.
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Initialize PM2 logging based on database configuration
async function initializePM2Logging() {
  try {
    const { getMainConfig } = await import('./routes/system');
    const config = await getMainConfig();
    const pm2Enabled = config.logging?.pm2LoggingEnabled ?? (process.env.PM2_LOGGING_ENABLED !== 'false');
    
    if (pm2Enabled) {
      PM2LogService.startStreaming();
      console.log(`📊 PM2 log streaming started for modl-panel instance (config: ${pm2Enabled})`);
    } else {
      console.log(`📊 PM2 log streaming is disabled by configuration`);
    }
  } catch (error) {
    console.error('Error reading PM2 config from database, using environment variable:', error);
    if (process.env.PM2_LOGGING_ENABLED !== 'false') {
      PM2LogService.startStreaming();
      console.log(`📊 PM2 log streaming started for modl-panel instance (fallback to env var)`);
    } else {
      console.log(`📊 PM2 log streaming is disabled (env var fallback)`);
    }
  }
}

// Start server
async function startServer() {
  try {
    await connectDatabase();
    
    server.listen(PORT, () => {
      console.log(`🚀 modl-admin server running on port ${PORT}`);
      console.log(`📧 Email service configured for ${process.env.SMTP_HOST || 'localhost'}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔌 Socket.IO enabled for real-time log streaming`);
      
      // Initialize PM2 log streaming based on configuration
      initializePM2Logging();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  PM2LogService.stopStreaming();
  io.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  PM2LogService.stopStreaming();
  io.close();
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer(); 