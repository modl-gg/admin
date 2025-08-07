import mongoose, { Connection } from 'mongoose';

let globalConnection: Connection | null = null;

/**
 * Get or create a connection to the global MongoDB database
 * This function returns the existing mongoose connection or creates a new one
 */
export async function connectToGlobalModlDb(): Promise<Connection> {
  try {
    // If we already have a connection and it's ready, return it
    if (globalConnection && globalConnection.readyState === 1) {
      return globalConnection;
    }

    // If mongoose is already connected, use the existing connection
    if (mongoose.connection.readyState === 1) {
      globalConnection = mongoose.connection;
      return globalConnection;
    }

    // If not connected, establish a new connection
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/modl-global';
    
    // Set connection options for better timeout handling
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 30000, // 30 seconds
      bufferMaxEntries: 0,
      bufferCommands: false,
    };

    await mongoose.connect(mongoUri, connectionOptions);
    globalConnection = mongoose.connection;
    
    console.log('✅ Global MongoDB connection established via connectionManager');
    return globalConnection;
  } catch (error) {
    console.error('❌ Failed to connect to global MongoDB:', error);
    throw error;
  }
}

/**
 * Close the global connection
 */
export async function closeGlobalConnection(): Promise<void> {
  if (globalConnection) {
    await globalConnection.close();
    globalConnection = null;
    console.log('🔒 Global MongoDB connection closed');
  }
}

/**
 * Get the current connection status
 */
export function getConnectionStatus(): number {
  return globalConnection?.readyState ?? mongoose.connection.readyState;
}