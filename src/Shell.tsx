// vk-shell/src/Shell.tsx
import React, { useCallback, useEffect, useState, Suspense } from "react";
import Header from "./components/Header";
import DepartmentTabs from "./components/DepartmentTabs";
import AppsStrip from "./components/AppsStrip";
import ContentArea from "./components/ContentArea";
import ThemeToggle from "./components/ThemeToggle";
import Launcher from "./components/Launcher";
import { useAppsRegistry } from "./hooks/useAppsRegistry";
import { getAppsByDepartment, getApps } from "./utils/registry";
import type { AppHostProps, AppMeta } from "./utils/types";

const STORAGE_RECENTS = "shell:recents";
const STORAGE_FAVS = "shell:favorites";

export default function Shell() {
  const { departments } = useAppsRegistry();
  const [selectedDept, setSelectedDept] = useState<string | null>(departments[0]?.id ?? null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<AppMeta | null>(null);
  const [AppComponent, setAppComponent] = useState<React.LazyExoticComponent<React.ComponentType<AppHostProps>> | null>(null);
  const [loading, setLoading] = useState(false);

  const [recents, setRecents] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_RECENTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<Record<string, true>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FAVS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!selectedDept && departments.length) setSelectedDept(departments[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments]);

  const persistRecents = (arr: string[]) => {
    setRecents(arr);
    try {
      localStorage.setItem(STORAGE_RECENTS, JSON.stringify(arr));
    } catch {}
  };

  const persistFavorites = (map: Record<string, true>) => {
    setFavorites(map);
    try {
      localStorage.setItem(STORAGE_FAVS, JSON.stringify(map));
    } catch {}
  };

  const openApp = useCallback(async (id: string) => {
    const entry = getApps().find((e) => e.meta.id === id);
    if (!entry) return;
    setLoading(true);
    setActiveAppId(id);
    setActiveMeta(entry.meta);
    const Lazy = React.lazy(() => entry.loader());
    setAppComponent(() => Lazy);

    // update recents (most recent first, unique, limit 10)
    setTimeout(() => {
      try {
        setRecents((prev) => {
          const next = [id, ...prev.filter((x) => x !== id)].slice(0, 10);
          localStorage.setItem(STORAGE_RECENTS, JSON.stringify(next));
          return next;
        });
      } catch {}
    }, 0);

    setTimeout(() => setLoading(false), 120);
  }, []);

  const closeApp = useCallback(() => {
    setAppComponent(null);
    setActiveAppId(null);
    setActiveMeta(null);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const next = { ...favorites };
    if (next[id]) {
      delete next[id];
    } else {
      next[id] = true;
    }
    persistFavorites(next);
  }, [favorites]);

  const request = useCallback(async <T = any>(action: string, payload?: any): Promise<T> => {
    switch (action) {
      case "ping":
        return Promise.resolve({ ok: true } as any);
      default:
        return Promise.resolve({} as any);
    }
  }, []);

  const sendMessage = useCallback((msg: any) => {
    console.debug("[shell] app message:", msg);
  }, []);

  const appsForDept = selectedDept ? getAppsByDepartment(selectedDept).map((e) => e.meta) : [];

  const showingLauncher = AppComponent == null;

  return (
    <div className="app-shell min-h-screen bg-surface text-text">
      {/* Centered container: aligns header + content */}
      <div className="app-container mx-auto max-w-[1200px] px-6 mt-6">
        <Header
          title={activeMeta?.title ?? "Программный комплекс — Облкоммунэнерго"}
          subtitle={activeMeta?.description ?? (showingLauncher ? "Все приложения в одном месте" : undefined)}
          right={<ThemeToggle />}
          onBack={!showingLauncher ? (() => closeApp()) : undefined}
        />

        {/* Show top tabs/strip only when app is open */}
        {!showingLauncher && (
          <>
            <DepartmentTabs
              departments={departments.map((d) => ({ ...d, appsCount: getAppsByDepartment(d.id).length }))}
              activeId={selectedDept}
              onSelect={(id) => {
                setSelectedDept(id);
              }}
            />

            <AppsStrip
              apps={appsForDept}
              activeAppId={activeAppId}
              onOpen={(id) => {
                openApp(id);
              }}
            />
          </>
        )}

        <main className="mt-6">
          <ContentArea>
            <Suspense fallback={<div className="p-6 rounded-xl app-card">Загрузка приложения...</div>}>
              <div className={showingLauncher ? "animate-fade-in-up" : "animate-fade-in"}>
                {!AppComponent ? (
                  <Launcher
                    departments={departments}
                    selectedDept={selectedDept}
                    onSelectDept={(id) => setSelectedDept(id)}
                    onOpenApp={(id) => openApp(id)}
                    recents={recents}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                  />
                ) : loading ? (
                  <div className="p-6 rounded-xl app-card">Загрузка...</div>
                ) : AppComponent ? (
                  <div className="animate-fade-in">
                    <AppComponent
                      className="w-full h-full"
                      request={request}
                      sendMessage={sendMessage}
                      onClose={closeApp}
                    />
                  </div>
                ) : null}
              </div>
            </Suspense>
          </ContentArea>
        </main>
      </div>
    </div>
  );
}
