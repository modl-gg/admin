import { useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';

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
  isConnected: boolean;
  newLogs: SystemLog[];
  clearNewLogs: () => void;
  startLogStream: () => void;
  stopLogStream: () => void;
}

export function useSocket(): UseSocketReturn {
  const [isConnected, setIsConnected] = useState(true);
  const [newLogs, setNewLogs] = useState<SystemLog[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<string | null>(null);

  const pollForNewLogs = useCallback(async () => {
    try {
      const params: Record<string, any> = {
        limit: 10,
        resolved: false,
      };

      if (lastTimestampRef.current) {
        params.startDate = lastTimestampRef.current;
      }

      const response = await apiClient.getSystemLogs(params);
      const logs = response.data?.logs || [];

      if (logs.length > 0) {
        const newestTimestamp = logs[0]?.timestamp;
        if (newestTimestamp && newestTimestamp !== lastTimestampRef.current) {
          const newEntries = lastTimestampRef.current
            ? logs.filter((log: SystemLog) => new Date(log.timestamp) > new Date(lastTimestampRef.current!))
            : [];

          if (newEntries.length > 0) {
            setNewLogs(prev => [...newEntries, ...prev].slice(0, 100));
          }

          lastTimestampRef.current = newestTimestamp;
        }
      }

      setIsConnected(true);
    } catch (error) {
      console.error('Failed to poll for new logs:', error);
      setIsConnected(false);
    }
  }, []);

  const startLogStream = useCallback(() => {
    if (isStreaming) return;

    setIsStreaming(true);
    pollForNewLogs();

    intervalRef.current = window.setInterval(pollForNewLogs, 5000);
  }, [isStreaming, pollForNewLogs]);

  const stopLogStream = useCallback(() => {
    setIsStreaming(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const clearNewLogs = useCallback(() => {
    setNewLogs([]);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    newLogs,
    clearNewLogs,
    startLogStream,
    stopLogStream,
  };
}
