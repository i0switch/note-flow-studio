import { create } from "zustand";

type AppStore = {
  selectedJobId: number | null;
  setSelectedJobId: (id: number | null) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  selectedJobId: null,
  setSelectedJobId: (selectedJobId) => set({ selectedJobId })
}));
