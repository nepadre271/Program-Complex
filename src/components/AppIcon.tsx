// src/components/AppIcon.tsx
import React from "react";
import * as Icons from "lucide-react";
import type { AppMeta } from "../utils/types";

export default function AppIcon({
  meta,
  active,
  onClick,
  showLabel = false,
  iconSize = 28,
  compact = false,
}: {
  meta: Pick<AppMeta, "icon" | "title" | "id">;
  active?: boolean;
  onClick?: () => void;
  showLabel?: boolean;
  iconSize?: number;
  compact?: boolean; // если true — уменьшенный вид (для small)
}) {
  const IconComp = (Icons as any)[meta.icon] ?? (Icons as any).Zap ?? (() => <span>?</span>);

  // sizes
  const box = compact ? 48 : 64;
  const innerRadius = compact ? 8 : 12;

  return (
    <button
      onClick={onClick}
      aria-label={meta.title}
      title={meta.title}
      className="flex flex-col items-center gap-2 focus:outline-none"
      style={{ background: "transparent", border: "none", padding: 0 }}
    >
      <div
        aria-hidden
        style={{
          width: box,
          height: box,
          minWidth: box,
          minHeight: box,
          borderRadius: innerRadius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          // gradient border look
          background: active
            ? "linear-gradient(180deg,#1f7bff,#0e57d6)"
            : "linear-gradient(180deg,#3aa0ff,#0066ff)",
          boxShadow: active ? "0 12px 36px rgba(16,88,255,0.18)" : "0 8px 20px rgba(6,40,80,0.06)",
        }}
      >
        {/* inner panel — slightly translucent to create layered look */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: innerRadius - 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.92)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          <IconComp size={iconSize} />
        </div>
      </div>

      {showLabel && (
        <span
          style={{
            maxWidth: 92,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
            textAlign: "center",
            color: "inherit",
          }}
        >
          {meta.title}
        </span>
      )}
    </button>
  );
}
