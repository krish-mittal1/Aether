"use client";

import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// Separate client for long-running operations (code execution can take up to 30s)
export const apiLong = axios.create({ baseURL: API_URL, timeout: 35000 });

function attachAuthInterceptor(instance) {
  instance.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (error) => {
      if (error.response?.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  );
}

attachAuthInterceptor(api);
attachAuthInterceptor(apiLong);
