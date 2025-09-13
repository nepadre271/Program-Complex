// vk-shell/src/components/ThemeToggle.tsx
import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

export default function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-pressed={dark}
      title="Переключить тему"
      className="p-2 rounded-md bg-white/8 hover:scale-105 transition-transform focus:outline-none focus:ring-2"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
