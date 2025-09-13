// vk-shell/src/components/ContentArea.tsx
import React from "react";

export default function ContentArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-md transition-all duration-220">
      {children}
    </div>
  );
}
