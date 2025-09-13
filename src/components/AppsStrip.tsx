// vk-shell/src/components/AppsStrip.tsx
import React from "react";
import AppIcon from "./AppIcon";
import type { AppMeta } from "../utils/types";

export default function AppsStrip({
  apps,
  activeAppId,
  onOpen,
}: {
  apps: AppMeta[];
  activeAppId?: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="w-full overflow-x-auto py-3 px-4">
      <div className="flex gap-3 items-center">
        {apps.map((app) => (
          <div key={app.id} className="flex-none">
            <AppIcon meta={app} active={activeAppId === app.id} onClick={() => onOpen(app.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
