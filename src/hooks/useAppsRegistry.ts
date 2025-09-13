// vk-shell/src/hooks/useAppsRegistry.ts
import { useMemo } from "react";
import { getDepartments, getAppsByDepartment } from "../utils/registry";
import type { Department, AppMeta } from "../utils/types";

export function useAppsRegistry() {
  const departments = useMemo(() => {
    const deps = getDepartments();
    return deps.map((d) => {
      const entries = getAppsByDepartment(d.id);
      const apps: AppMeta[] = entries.map((e) => e.meta);
      return { ...d, apps };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { departments };
}
