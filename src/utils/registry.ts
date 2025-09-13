// vk-shell/src/utils/registry.ts
import type { AppLoader, AppMeta, Department } from "./types";

type AppEntry = {
  loader: AppLoader;
  meta: AppMeta;
};

const map: Record<string, AppEntry> = {};

/** Register an app into the registry. meta should include departmentId/Title if needed. */
export function registerApp(id: string, loader: AppLoader, meta: AppMeta) {
  if (map[id]) {
    console.warn(`[registry] re-registering app ${id}`);
  }
  map[id] = { loader, meta };
}

/** Return all registered app entries. */
export function getApps(): AppEntry[] {
  return Object.values(map);
}

/** Return departments discovered from apps (unique). */
export function getDepartments(): Department[] {
  const m = new Map<string, Department>();
  Object.values(map).forEach((entry) => {
    const id = entry.meta.departmentId ?? "general";
    const title = entry.meta.departmentTitle ?? "Общее";
    if (!m.has(id)) m.set(id, { id, title });
  });
  return Array.from(m.values());
}

/** Return apps for a given department id. */
export function getAppsByDepartment(deptId: string): AppEntry[] {
  return Object.values(map).filter(
    (e) => (e.meta.departmentId ?? "general") === deptId
  );
}

/** Lazy-load app module by id (throws if not found). */
export async function loadApp(id: string) {
  const entry = map[id];
  if (!entry) throw new Error(`App ${id} not found`);
  return entry.loader();
}
