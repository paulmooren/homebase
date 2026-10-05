"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useModules } from "@/components/use-modules";

/** Opens the first list Module the household has switched on. */
export default function ListsIndex() {
  const router = useRouter();
  const { ready, isEnabled } = useModules();

  useEffect(() => {
    if (!ready) return;
    router.replace(
      isEnabled("shopping") ? "/lists/shopping" : isEnabled("wishlist") ? "/lists/wishlist" : "/dashboard",
    );
  }, [ready, isEnabled, router]);

  return null;
}
