import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logsApi } from '../services/api';

export function useLogs(filters?: {
  method?: string;
  status?: number;
  path?: string;
  limit?: number;
  offset?: number;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['logs', filters];
  const limit = filters?.limit ?? 100;

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');

    es.onmessage = (event) => {
      const newLog = JSON.parse(event.data);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          logs: [newLog, ...old.logs].slice(0, limit),
          total: old.total + 1,
        };
      });
    };

    es.onerror = () => es.close();
    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await logsApi.getLogs(filters);
      return response.data;
    },
  });
}
