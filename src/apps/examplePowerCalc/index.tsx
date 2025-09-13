// vk-shell/src/apps/examplePowerCalc/index.tsx

import React, { useState } from "react";
import type { AppHostProps } from "../../utils/types";
import { meta } from "./meta";

export { meta };

export default function PowerCalc({ className }: AppHostProps) {
  const [u, setU] = useState(220);
  const [i, setI] = useState(10);
  const [cosPhi, setCosPhi] = useState(0.95);

  const s = u * i;
  const p = s * cosPhi;
  const q = Math.sqrt(Math.max(0, s * s - p * p));

  return (
    <div className={`p-4 rounded-xl ${className ?? ""} bg-blue-50`}>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col">
          <span className="text-sm">U, В</span>
          <input type="number" value={u} onChange={(e) => setU(Number(e.target.value))} className="mt-1 p-2 rounded border" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">I, А</span>
          <input type="number" value={i} onChange={(e) => setI(Number(e.target.value))} className="mt-1 p-2 rounded border" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm">cosφ</span>
          <input type="number" step="0.01" min="0" max="1" value={cosPhi} onChange={(e) => setCosPhi(Number(e.target.value))} className="mt-1 p-2 rounded border" />
        </label>
      </div>

      <div className="mt-4 p-3 rounded bg-blue-100">
        <div className="flex justify-between"><span>S, В·А</span><strong>{s.toFixed(2)}</strong></div>
        <div className="flex justify-between"><span>P, Вт</span><strong>{p.toFixed(2)}</strong></div>
        <div className="flex justify-between"><span>Q, Вар</span><strong>{q.toFixed(2)}</strong></div>
        <div className="flex justify-between"><span>φ (°)</span><strong>{(Math.acos(cosPhi)*(180/Math.PI)).toFixed(1)}</strong></div>
      </div>
    </div>
  );
}
