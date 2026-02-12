import { create } from 'zustand';

interface OfflineState {
    isOnline: boolean;
    setOnline: (online: boolean) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    setOnline: (online) => set({ isOnline: online }),
}));

