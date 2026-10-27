"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clearAuthSession,
  getSavedUser,
  saveAuthSession,
} from "@/lib/hotelApi";

export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const saved = getSavedUser();
    if (saved) {
      saveAuthSession(saved);
      router.replace("/dashboard");
    } else {
      clearAuthSession();
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center bg-ink-900">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400/20 border-t-gold-400"></div>
    </div>
  );
}
