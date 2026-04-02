import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playbackApi } from '../services/api';

export function useTargets() {
  return useQuery({
    queryKey: ['playback-targets'],
    queryFn: async () => {
      const response = await playbackApi.getTargets();
      return response.data;
    },
  });
}

export function useMappings(targetId: number) {
  return useQuery({
    queryKey: ['playback-mappings', targetId],
    queryFn: async () => {
      const response = await playbackApi.getMappings(targetId);
      return response.data;
    },
  });
}

export function useCreateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; url: string; token?: string }) =>
      playbackApi.createTarget(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-targets'] }),
  });
}

export function useUpdateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; url: string; token?: string } }) =>
      playbackApi.updateTarget(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-targets'] }),
  });
}

export function useDeleteTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => playbackApi.deleteTarget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-targets'] }),
  });
}

export function useDeleteMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => playbackApi.deleteMapping(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-mappings'] }),
  });
}

export function usePlaybackLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, targetId }: { logId: number; targetId: number }) =>
      playbackApi.playbackLog(logId, targetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-mappings'] }),
  });
}

export function usePlaybackEntity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, scimitId, targetId }: { entityType: 'User' | 'Group'; scimitId: string; targetId: number }) =>
      playbackApi.playbackEntity(entityType, scimitId, targetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playback-mappings'] }),
  });
}
