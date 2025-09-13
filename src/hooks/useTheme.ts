/* vk-shell/src/hooks/useTheme.ts */

import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("shell:dark") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("shell:dark", "1");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("shell:dark", "0");
    }
  }, [dark]);

  return { dark, toggle: () => setDark((s) => !s), setDark };
}
