import { useEffect, useRef, useState, useCallback } from 'react';
import { monitoringService, type SystemLog } from '@/lib/services/monitoring-service';

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
      const logsResponse = await monitoringService.getSystemLogs({
        limit: 10,
        resolved: false,
        startDate: lastTimestampRef.current ?? undefined,
      });

      const logs = logsResponse.logs;

      if (logs.length > 0) {
        const newestTimestamp = logs[0]?.timestamp;
        if (newestTimestamp && newestTimestamp !== lastTimestampRef.current) {
          const newEntries = lastTimestampRef.current
            ? logs.filter((log) => {
                if (!log.timestamp || !lastTimestampRef.current) {
                  return false;
                }

                return new Date(log.timestamp) > new Date(lastTimestampRef.current);
              })
            : [];

          if (newEntries.length > 0) {
            setNewLogs((previous) => [...newEntries, ...previous].slice(0, 100));
          }

          lastTimestampRef.current = newestTimestamp;
        }
      }

      setIsConnected(true);
    } catch (caught) {
      console.error('Failed to poll for new logs:', caught);
      setIsConnected(false);
    }
  }, []);

  const startLogStream = useCallback(() => {
    if (isStreaming) {
      return;
    }

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
