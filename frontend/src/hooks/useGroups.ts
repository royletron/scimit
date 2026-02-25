import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/api';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await adminApi.getGroups();
      return response.data;
    },
  });
}
