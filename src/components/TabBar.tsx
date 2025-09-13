// vk-shell/src/components/TabBar.tsx

import AppIcon from "./AppIcon";

export default function TabBar({
  apps,
  activeId,
  onOpen,
}: {
  apps: Array<{ meta: any; loader: any }>;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {apps.map(app => (
        <AppIcon
          key={app.meta.id}
          meta={app.meta}
          active={activeId === app.meta.id}
          onClick={() => onOpen(app.meta.id)}
        />
      ))}
    </div>
  );
}
