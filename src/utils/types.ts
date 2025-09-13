// vk-shell/src/utils/types.ts
import React from "react";

/**
 * Department описывает группу/отдел в организации.
 */
export interface Department {
  id: string;
  title: string;
  icon?: string;
  description?: string;
}

/** Размеры окна приложения */
export type AppSize = "small" | "medium" | "large";

/**
 * App metadata exported by each app's meta.ts
 * Добавлены departmentId / departmentTitle для группировки.
 */
export interface AppMeta {
  id: string;
  title: string;
  icon: string; // lucide-react icon name or custom
  size: AppSize;
  description?: string;
  departmentId?: string;
  departmentTitle?: string;
}

/**
 * Props passed by Shell to an embedded App.
 */
export interface AppHostProps {
  onClose?: () => void;
  initialState?: any;
  sendMessage?: (msg: any) => void;
  request?: <T = any>(action: string, payload?: any) => Promise<T>;
  className?: string;
}

/**
 * Loader returns a React component default export and meta.
 */
export type AppLoader = () => Promise<{
  default: React.ComponentType<AppHostProps>;
  meta: AppMeta;
}>;
