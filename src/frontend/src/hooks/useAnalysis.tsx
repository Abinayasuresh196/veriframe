import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AnalysisId, AnalysisRecord, ShareToken } from "../lib/types";
import { useAuthContext } from "../contexts/AuthContext";
import { PythonBackend } from "../lib/pythonBackend";

export function useGetAnalysisResult(id: AnalysisId | null) {
  const { principal } = useAuthContext();
  const backend = new PythonBackend(principal);
  
  return useQuery<AnalysisRecord | null>({
    queryKey: ["analysis", id],
    queryFn: async () => {
      if (!principal || !id) return null;
      return backend.getAnalysisResult(id);
    },
    enabled: !!principal && !!id,
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
  const backend = new PythonBackend(null);
  
  return useQuery<AnalysisRecord | null>({
    queryKey: ["sharedAnalysis", token],
    queryFn: async () => {
      if (!token) return null;
      return backend.getSharedAnalysis(token);
    },
    enabled: !!token,
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
  const { principal } = useAuthContext();
  const backend = new PythonBackend(principal);
  
  return useMutation<string, Error, AnalysisId>({
    mutationFn: async (id) => {
      if (!principal) throw new Error("User not authenticated");
      return backend.generateShareToken(id);
    },
  });
}