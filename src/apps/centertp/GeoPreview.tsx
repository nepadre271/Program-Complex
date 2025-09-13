import React, { useEffect, useRef, useState } from "react";
import type { PolyObj, Point } from "./types";

export default function GeoPreview({
  width,
  height,
  objects,
  showLabels,
  invertY,
  loadCenterPlot,
  swapOnImport,
  viewScale,
  selectedIndex,
  onSelect,
}: {
  width: number;
  height: number;
  objects: PolyObj[];
  showLabels: boolean;
  invertY: boolean;
  loadCenterPlot?: Point | null;
  swapOnImport: boolean;
  viewScale: number;
  selectedIndex?: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: width, h: height });

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) {
      setSize({ w: width, h: height });
      return;
    }
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const cr = e.contentRect;
      setSize({ w: Math.max(100, Math.floor(cr.width)), h: Math.max(100, Math.floor(cr.height)) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [width, height]);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let found = false;
  for (const o of objects) {
    for (const p of o.plotPoints) {
      const [x, y] = p;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      found = true;
    }
  }

  if (!found) {
    return (
      <div ref={svgContainerRef} className="w-full h-full flex items-center justify-center text-gray-400">
        Нет полигонов
      </div>
    );
  }

  const padFrac = 0.06;
  const spanX = Math.max(1e-9, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);
  const padX = spanX * padFrac;
  const padY = spanY * padFrac;
  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;
  const worldW = Math.max(1e-9, maxX - minX);
  const worldH = Math.max(1e-9, maxY - minY);
  const innerW = Math.max(100, size.w);
  const innerH = Math.max(100, size.h);
  const baseScale = Math.min(innerW / worldW, innerH / worldH);
  const usedW = worldW * baseScale;
  const usedH = worldH * baseScale;
  const baseOffsetX = (innerW - usedW) / 2;
  const baseOffsetY = (innerH - usedH) / 2;

  const projectBase = ([x, y]: Point): [number, number] => {
    const px = (x - minX) * baseScale + baseOffsetX;
    const py = invertY ? (maxY - y) * baseScale + baseOffsetY : (y - minY) * baseScale + baseOffsetY;
    return [px, py];
  };

  const projected = objects.map((o) => {
    const pts = o.plotPoints.map(projectBase);
    let cx = 0,
      cy = 0;
    if (pts.length) {
      for (const p of pts) {
        cx += p[0];
        cy += p[1];
      }
      cx /= pts.length;
      cy /= pts.length;
    }
    let minPx = Infinity,
      minPy = Infinity,
      maxPx = -Infinity,
      maxPy = -Infinity;
    for (const p of pts) {
      if (p[0] < minPx) minPx = p[0];
      if (p[1] < minPy) minPy = p[1];
      if (p[0] > maxPx) maxPx = p[0];
      if (p[1] > maxPy) maxPy = p[1];
    }
    return { o, pts, cx, cy, bbox: { minPx, minPy, maxPx, maxPy } };
  });

  let centerProjected: [number, number] | null = null;
  if (loadCenterPlot) {
    try {
      centerProjected = projectBase(loadCenterPlot);
    } catch {
      centerProjected = null;
    }
  }

  const meterToPx = baseScale * viewScale;
  const computeRadiusPxFromSmeters = (S: number | null) => {
    if (S == null || !Number.isFinite(S) || S <= 0) return 2;
    const radiusMeters = S / 2;
    const rpx = radiusMeters * meterToPx;
    return Math.max(2, Math.min(rpx, 2000));
  };
  const CENTER_DOT_HIDE_THRESHOLD_PX = 4;

  return (
    <div ref={svgContainerRef} className="w-full h-full">
      <svg width="100%" height="100%" viewBox={`0 0 ${innerW} ${innerH}`} preserveAspectRatio="xMidYMid meet">
        <rect x={0} y={0} width={innerW} height={innerH} fill="transparent" />
        <g>
          {projected.map((g, idx) => {
            if (!g.pts || g.pts.length < 2) return null;
            const pointsAttr = g.pts.map((p) => `${p[0]},${p[1]}`).join(" ");

            const parseNum = (s?: string) => {
              if (!s) return NaN;
              const n = parseFloat(String(s).replace(",", ".").replace(/[^\d.\-eE+]/g, ""));
              return Number.isFinite(n) ? n : NaN;
            };

            const P = parseNum(g.o.p_active);
            const Q_input = parseNum(g.o.p_reactive);
            const pf = parseNum(g.o.pf);
            let S = parseNum(g.o.p_full);
            if (!Number.isFinite(S) && Number.isFinite(P) && Number.isFinite(pf) && pf !== 0) S = P / pf;
            let Q = Number.isFinite(Q_input) ? Q_input : NaN;
            if (!Number.isFinite(Q) && Number.isFinite(P) && Number.isFinite(pf) && pf !== 0) {
              const sq = Math.max(0, 1 - pf * pf);
              const tanphi = Math.sqrt(sq) / pf;
              Q = P * tanphi;
            }
            if (!Number.isFinite(S) && Number.isFinite(P) && Number.isFinite(Q)) S = Math.sqrt(P * P + Q * Q);

            const radiusPx = computeRadiusPxFromSmeters(Number.isFinite(S) ? S : null);
            const reactiveShare = Number.isFinite(Q) && Number.isFinite(S) && S > 0 ? Q / S : 0;
            const reactiveAngle = reactiveShare * Math.PI * 2;

            let pieCx = g.cx;
            let pieCy = g.cy;
            if (g.o.centerOrigX != null && g.o.centerOrigY != null) {
              const cxOrig = g.o.centerOrigX;
              const cyOrig = g.o.centerOrigY;
              const plotX = swapOnImport ? cyOrig : cxOrig;
              const plotY = swapOnImport ? cxOrig : cyOrig;
              try {
                const [pcx, pcy] = projectBase([plotX, plotY]);
                pieCx = pcx;
                pieCy = pcy;
              } catch {}
            }

            const start = -Math.PI / 2;
            const endReactive = start + reactiveAngle;
            const isSelected = selectedIndex === idx;
            const visualCenterDotR = Math.max(3, 6);
            const centerDotVisible = !(Number.isFinite(radiusPx) && radiusPx > CENTER_DOT_HIDE_THRESHOLD_PX);

            return (
              <g key={idx} onClick={(e) => { e.stopPropagation(); onSelect(isSelected ? null : idx); }} style={{ cursor: "pointer" }}>
                <polygon
                  fill="rgba(38,115,240,0.06)"
                  stroke={isSelected ? "rgba(21,78,216,0.85)" : "rgba(21,78,216,0.32)"}
                  strokeWidth={isSelected ? 2.4 : 1.2}
                  points={pointsAttr}
                />

                <g>
                  <circle cx={pieCx} cy={pieCy} r={radiusPx} fill="rgba(255,255,255,0.85)" stroke="rgba(21,78,216,0.06)" strokeWidth={1} />
                  {reactiveAngle > 1e-6 && (
                    <path
                      d={(() => {
                        const cx = pieCx;
                        const cy = pieCy;
                        const r = radiusPx;
                        const sx = cx + r * Math.cos(start);
                        const sy = cy + r * Math.sin(start);
                        const ex = cx + r * Math.cos(endReactive);
                        const ey = cy + r * Math.sin(endReactive);
                        const laf = Math.abs(endReactive - start) > Math.PI ? 1 : 0;
                        return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${laf} 1 ${ex} ${ey} Z`;
                      })()}
                      fill="rgba(255,92,92,0.95)"
                      stroke="rgba(224,63,63,0.12)"
                      strokeWidth={0.5}
                    />
                  )}
                  <circle cx={pieCx} cy={pieCy} r={radiusPx} fill="none" stroke="rgba(6,40,33,0.04)" strokeWidth={1} />
                </g>

                {centerDotVisible && (
                  <>
                    <circle cx={pieCx} cy={pieCy} r={visualCenterDotR} fill="#154ed8" stroke="#fff" strokeWidth={1} />
                    {showLabels && <text x={pieCx + 8} y={pieCy - 8} fill="#154ed8" fontSize={12} fontWeight={700}>{g.o.cadastral}</text>}
                  </>
                )}

                {!centerDotVisible && showLabels && (
                  <text x={pieCx + radiusPx + 10} y={pieCy - 6} fill="#154ed8" fontSize={12} fontWeight={700}>
                    {g.o.cadastral}
                  </text>
                )}
              </g>
            );
          })}

          {centerProjected && (
            <g>
              <circle cx={centerProjected[0]} cy={centerProjected[1]} r={12} fill="#154ed8" stroke="#fff" strokeWidth={2} />
              <text x={centerProjected[0]} y={centerProjected[1] + 20} textAnchor="middle" fill="#0b2740" fontSize={12} fontWeight={700}>
                ЦН
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
