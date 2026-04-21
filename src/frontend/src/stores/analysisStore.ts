import { create } from "zustand";
import type { AnalysisId, HistoryFilter } from "../lib/types";

interface AnalysisStore {
  currentAnalysisId: AnalysisId | null;
  uploadProgress: number;
  processingStatus: string;
  selectedHistoryFilter: HistoryFilter;
  currentFile: File | null;
  setCurrentAnalysisId: (id: AnalysisId | null) => void;
  setUploadProgress: (progress: number) => void;
  setProcessingStatus: (status: string) => void;
  setSelectedHistoryFilter: (filter: HistoryFilter) => void;
  setCurrentFile: (file: File | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  currentAnalysisId: null,
  uploadProgress: 0,
  processingStatus: "",
  selectedHistoryFilter: "all",
  currentFile: null,
  setCurrentAnalysisId: (id) => set({ currentAnalysisId: id }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setSelectedHistoryFilter: (filter) => set({ selectedHistoryFilter: filter }),
  setCurrentFile: (file) => set({ currentFile: file }),
  reset: () =>
    set({
      currentAnalysisId: null,
      uploadProgress: 0,
      processingStatus: "",
    }),
}));
