import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "success") => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToast.getState().push(m, "success"),
  error: (m: string) => useToast.getState().push(m, "error"),
  info: (m: string) => useToast.getState().push(m, "info"),
};
