import { create } from "zustand";
import { authApi, getToken, setToken } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "authed" | "anon";
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  init: async () => {
    if (!getToken()) {
      set({ status: "anon" });
      return;
    }
    set({ status: "loading" });
    try {
      const user = await authApi.me();
      set({ user, status: "authed" });
    } catch {
      setToken(null);
      set({ user: null, status: "anon" });
    }
  },

  login: async (email, password) => {
    const res = await authApi.login(email, password);
    setToken(res.access_token);
    set({ user: res.user, status: "authed" });
  },

  register: async (email, password, fullName) => {
    const res = await authApi.register(email, password, fullName);
    setToken(res.access_token);
    set({ user: res.user, status: "authed" });
  },

  logout: () => {
    setToken(null);
    set({ user: null, status: "anon" });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("transcriptai:signout", () => useAuth.getState().logout());
}
