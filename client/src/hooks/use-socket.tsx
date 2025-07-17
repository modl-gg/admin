import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SystemLog {
  _id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  category?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  newLogs: SystemLog[];
  clearNewLogs: () => void;
  startLogStream: () => void;
  stopLogStream: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newLogs, setNewLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    // Create socket connection
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('Server confirmation:', data.message);
    });

    // Real-time log updates
    socket.on('newLog', (logEntry: SystemLog) => {
      console.log('New log received:', logEntry);
      setNewLogs(prev => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 new logs
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const clearNewLogs = () => {
    setNewLogs([]);
  };

  const startLogStream = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('startLogStream');
    }
  };

  const stopLogStream = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('stopLogStream');
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    newLogs,
    clearNewLogs,
    startLogStream,
    stopLogStream,
  };
} 