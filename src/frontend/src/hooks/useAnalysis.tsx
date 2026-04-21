import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisId, AnalysisRecord, ShareToken } from "../lib/types";
import { useActor } from "./useActor";
import { useAuthContext } from "../contexts/AuthContext";
import { PythonBackend } from "../lib/pythonBackend";

export function useGetAnalysisResult(id: AnalysisId | null) {
  const { actor, isFetching } = useActor();
  return useQuery<AnalysisRecord | null>({
    queryKey: ["analysis", id],
    queryFn: async () => {
      if (!actor || !id) return null;
      return actor.getAnalysisResult(id);
    },
    enabled: !!actor && !isFetching && !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "Processing" || data?.status === "Queued") {
        return 3000;
      }
      return false;
    },
  });
}

export function useGetUserHistory() {
  const { principal } = useAuthContext();
  const backend = new PythonBackend(principal);

  return useQuery<AnalysisRecord[]>({
    queryKey: ["userHistory"],
    queryFn: async () => {
      return backend.getUserHistory();
    },
    enabled: !!principal,
  });
}

export function useGetSharedAnalysis(token: ShareToken | null) {
  const { actor, isFetching } = useActor();
  return useQuery<AnalysisRecord | null>({
    queryKey: ["sharedAnalysis", token],
    queryFn: async () => {
      if (!actor || !token) return null;
      return actor.getSharedAnalysis(token);
    },
    enabled: !!actor && !isFetching && !!token,
  });
}

export function useSubmitVideoAnalysis() {
  const { principal } = useAuthContext();
  const queryClient = useQueryClient();
  return useMutation<
    AnalysisId,
    Error,
    {
      filename: string;
      fileSize: bigint;
      frameCount?: bigint;
      frameRate?: number;
      resolution?: string;
      file?: File;
    }
  >({
    mutationFn: async ({
      filename,
      fileSize,
      frameCount,
      frameRate,
      resolution,
      file,
    }) => {
      const backend = new PythonBackend(principal);
      return backend.submitVideoAnalysis(filename, fileSize, {
        frameCount,
        frameRate,
        resolution,
      }, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userHistory"] });
    },
  });
}

export function useDeleteAnalysisRecord() {
  const { principal } = useAuthContext();
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, AnalysisId>({
    mutationFn: async (id) => {
      const backend = new PythonBackend(principal);
      return backend.deleteAnalysisRecord(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userHistory"] });
    },
  });
}

export function useGenerateShareToken() {
  const { actor } = useActor();
  return useMutation<string, Error, AnalysisId>({
    mutationFn: async (id) => {
      if (!actor) throw new Error("Actor not available");
      return actor.generateShareToken(id);
    },
  });
}