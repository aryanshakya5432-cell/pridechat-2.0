"use client";

import { useState, useEffect } from "react";

export function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback ? (
      <div className="flex min-h-screen items-center justify-center bg-[#050507]">
        <span className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30" />
      </div>
    ) : null;
  }

  return children;
}