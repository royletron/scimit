import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logsApi } from '../services/api';
import { subscribeLive } from '../services/live';

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

  useEffect(() =>
    subscribeLive((newLog) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old || old.logs.some((l: any) => l.id === newLog.id)) return old;
        return {
          ...old,
          // _live marks rows that arrived while the page was open, so they can flash in
          logs: [{ ...newLog, _live: true }, ...old.logs].slice(0, limit),
          total: old.total + 1,
        };
      });
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await logsApi.getLogs(filters);
      return response.data;
    },
  });
}
