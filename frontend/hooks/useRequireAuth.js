"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

export function useRequireAuth() {
  const router = useRouter();
  const { user, booted, load } = useAuthStore();
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (booted && !user) router.replace("/login");
  }, [booted, user, router]);
  return { user, booted };
}
