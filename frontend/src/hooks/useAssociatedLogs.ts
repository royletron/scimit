import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/api';

export function useUserLogs(userId: string) {
  return useQuery({
    queryKey: ['users', userId, 'logs'],
    queryFn: async () => {
      const response = await adminApi.getUserLogs(userId);
      return response.data;
    },
  });
}

export function useGroupLogs(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId, 'logs'],
    queryFn: async () => {
      const response = await adminApi.getGroupLogs(groupId);
      return response.data;
    },
  });
}
