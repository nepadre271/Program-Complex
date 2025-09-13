// src/components/Launcher.tsx
import React, { useMemo, useState } from "react";
import type { Department, AppMeta } from "../utils/types";
import { getAppsByDepartment } from "../utils/registry";
import AppIcon from "./AppIcon";
import * as Icons from "lucide-react";

/**
 * Launcher — стартовая обёртка.
 */
export default function Launcher({
  departments,
  selectedDept,
  onSelectDept,
  onOpenApp,
}: {
  departments: Department[];
  selectedDept?: string | null;
  onSelectDept: (id: string) => void;
  onOpenApp: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [detailApp, setDetailApp] = useState<AppMeta | null>(null);

  const dept = departments.find((d) => d.id === selectedDept) ?? departments[0];

  const entries = useMemo(() => {
    if (!dept) return [];
    const raw = getAppsByDepartment(dept.id);
    return raw.map((r) => ({ meta: r.meta, loader: r.loader }));
  }, [dept]);

  const appsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.map((e) => e.meta);
    return entries
      .map((e) => e.meta)
      .filter((m) => m.title.toLowerCase().includes(q) || (m.description ?? "").toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <section className="launcher min-h-[60vh] flex flex-col gap-6">
      {/* Top hero unchanged (omitted here for brevity) */}
      <div className="bg-gradient-to-r from-electric-50 to-white/60 rounded-2xl p-6 shadow-md border border-white/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-electric-400 to-electric-600 text-white shadow-lg">
              <Icons.FolderMinus size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Добро пожаловать</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Выберите отдел слева или воспользуйтесь поиском по приложениям.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">Отдел: </div>
            <div className="inline-flex gap-2">
              {departments.map((d) => {
                const active = d.id === (dept?.id ?? "");
                const Icon = (Icons as any)[d.icon ?? "Folder"] ?? Icons.Folder;
                return (
                  <button
                    key={d.id}
                    onClick={() => onSelectDept(d.id)}
                    className={`px-3 py-2 rounded-full font-medium transition ${
                      active ? "bg-electric-500 text-white shadow" : "bg-white/70 dark:bg-gray-800/60"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={16} />
                      {d.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск приложений..."
            className="flex-1 p-3 rounded-lg border bg-white/60 dark:bg-gray-800/60 outline-none focus:ring-2 focus:ring-electric-300"
          />
          <button onClick={() => setQuery("")} className="px-4 py-2 rounded-lg bg-white/80 dark:bg-gray-700/60">
            Очистить
          </button>
        </div>
      </div>

      {/* Apps grid: responsive, large apps can span 2 cols on lg */}
      <div>
        <h3 className="text-lg font-semibold mb-3">{dept?.title ?? "Приложения"}</h3>

        {appsFiltered.length === 0 ? (
          <div className="p-6 rounded-xl bg-white/60 dark:bg-gray-800/60">Нет приложений в этом отделе.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries
              .filter((e) => appsFiltered.find((m) => m.id === e.meta.id))
              .map((entry) => {
                const m = entry.meta as AppMeta;

                // визуальные варианты по размеру meta.size
                const isSmall = m.size === "small";
                const isMedium = m.size === "medium";
                const isLarge = m.size === "large";

                // large: занимает 2 cols on lg
                const colClass = isLarge ? "lg:col-span-2" : "";

                // compact vs regular height
                const compactClass = isSmall ? "py-3" : "py-4";

                // size badge visual
                const badge =
                  isSmall ? (
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border">S</span>
                  ) : isMedium ? (
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs bg-sky-50 text-sky-700 border border-sky-100">M</span>
                  ) : (
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs bg-rose-50 text-rose-700 border border-rose-100">L</span>
                  );

                return (
                  <article
                    key={m.id}
                    className={`${colClass} ${compactClass} rounded-2xl bg-white/95 dark:bg-gray-800/60 shadow hover:shadow-lg transition-transform transform hover:-translate-y-1 cursor-pointer animate-card`}
                    onClick={() => onOpenApp(m.id)}
                    onMouseEnter={() => {
                      try {
                        entry.loader();
                      } catch {}
                    }}
                    role="button"
                    aria-label={`Открыть ${m.title}`}
                  >
                    <div className="flex items-center gap-4 px-4">
                      <div className="flex-none">
                        <AppIcon meta={m} showLabel={false} iconSize={isSmall ? 22 : 28} compact={isSmall} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-semibold text-base">{m.title}</div>
                            <div
                              className="text-sm text-gray-500 mt-1"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {m.description}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 ml-3">
                            {/* size badge */}
                            {badge}

                            {/* details button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailApp(m);
                              }}
                              title="Подробнее"
                              className="p-2 rounded-md bg-white/60 border text-gray-600 hover:bg-white"
                              aria-label={`Подробнее о ${m.title}`}
                            >
                              <Icons.Info size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </div>

      {/* Details modal */}
      {detailApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Информация о приложении ${detailApp.title}`}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailApp(null)}
            aria-hidden
          />
          <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full z-10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-none">
                <AppIcon meta={detailApp} showLabel={false} iconSize={36} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{detailApp.title}</h3>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{detailApp.description}</p>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDetailApp(null);
                      onOpenApp(detailApp.id);
                    }}
                    className="px-4 py-2 rounded-md bg-electric-600 text-white font-medium"
                  >
                    Открыть приложение
                  </button>

                  <button onClick={() => setDetailApp(null)} className="px-4 py-2 rounded-md border">
                    Закрыть
                  </button>
                </div>
              </div>
              <button
                onClick={() => setDetailApp(null)}
                aria-label="Закрыть"
                className="ml-4 text-gray-400 hover:text-gray-700"
              >
                <Icons.X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
