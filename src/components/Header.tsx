// vk-shell/src/components/Header.tsx
import React from "react";
import { ArrowLeft } from "lucide-react";
import logoUrl from "../assets/logo.png";

export default function Header({
  title,
  subtitle,
  right,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Назад"
            className="p-2 rounded-full bg-white/10 hover:bg-white/12 text-electric-600 dark:text-white transition focus:outline-none focus:ring-2"
            title="Вернуться в лаунчер"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gradient-to-br from-electric-400 to-electric-600 flex items-center justify-center shadow-md">
            <img src={logoUrl} alt="Логотип" className="w-10 h-10 object-contain" />
          </div>

          <div>
            <h1 className="text-xl font-semibold leading-tight">{title ?? "Программный комплекс — Оболочка"}</h1>
            {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}
