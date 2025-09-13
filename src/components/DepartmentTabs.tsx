// vk-shell/src/components/DepartmentTabs.tsx
import React from "react";
import * as Icons from "lucide-react";
import type { Department } from "../utils/types";

export default function DepartmentTabs({
  departments,
  activeId,
  onSelect,
}: {
  departments: Array<Department & { appsCount?: number; icon?: string }>;
  activeId?: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Отделы" className="w-full">
      <div className="flex gap-3 overflow-x-auto py-3 px-4">
        {departments.map((dep) => {
          const IconComp = dep.icon ? (Icons as any)[dep.icon] ?? Icons.Folder : Icons.Folder;
          const active = activeId === dep.id;
          return (
            <button
              key={dep.id}
              onClick={() => onSelect(dep.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl font-medium whitespace-nowrap transition shadow-sm focus:outline-none focus:ring-2 ${
                active
                  ? "bg-gradient-to-r from-electric-400 to-electric-600 text-white shadow-lg"
                  : "bg-white/60 dark:bg-gray-800/60 hover:shadow-sm"
              }`}
            >
              <IconComp size={18} />
              <span>{dep.title}</span>
              {typeof dep.appsCount === "number" && <span className="text-xs opacity-80">({dep.appsCount})</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
