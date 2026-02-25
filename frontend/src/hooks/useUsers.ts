import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../services/api';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await adminApi.getUsers();
      return response.data;
    },
  });
}
