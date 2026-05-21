"use client";

import { create } from "zustand";
import { api } from "../lib/api";

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  booted: false,
  load: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const cached = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (!token) return set({ user: null, token: null, booted: true });
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("user", JSON.stringify(data));
      set({ user: data, token, booted: true });
    } catch {
      set({ user: cached ? JSON.parse(cached) : null, token, booted: true });
    }
  },
  setSession: ({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, user, booted: true });
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null, booted: true });
  }
}));
