import type { PolyObj, Point } from "./types";

/** Small DXF builder & export helpers used by Centertp */
type DXFPoint = {
  x: number;
  y: number;
  layer?: string;
  circleRadius?: number | null;
  reactiveShare?: number;
  isLoadCenter?: boolean;
  logoSize?: number | null;
};

const writeDXFLines = (lines: string[]) => lines.join("\r\n") + "\r\n";

export function makeDXF(points: DXFPoint[]) {
  const lines: string[] = [];
  const w = (code: number | string, value: any) => {
    lines.push(String(code));
    lines.push(String(value));
  };

  w(0, "SECTION");
  w(2, "HEADER");
  w(0, "ENDSEC");

  w(0, "SECTION");
  w(2, "ENTITIES");

  for (const p of points) {
    const layer = p.layer ?? "0";

    if (p.isLoadCenter) {
      const r = p.logoSize && Number.isFinite(p.logoSize) && p.logoSize > 0 ? p.logoSize : 1.0;
      const innerR = r * 0.4;
      // outer circle
      w(0, "CIRCLE");
      w(8, layer);
      w(10, Number(p.x).toFixed(6));
      w(20, Number(p.y).toFixed(6));
      w(30, 0.0);
      w(40, Number(r.toFixed(6)));
      // inner circle
      w(0, "CIRCLE");
      w(8, layer);
      w(10, Number(p.x).toFixed(6));
      w(20, Number(p.y).toFixed(6));
      w(30, 0.0);
      w(40, Number(innerR.toFixed(6)));
      // crosshair and diagonals
      w(0, "LINE");
      w(8, layer);
      w(10, Number((p.x - r * 0.9).toFixed(6)));
      w(20, Number(p.y.toFixed(6)));
      w(30, 0.0);
      w(11, Number((p.x + r * 0.9).toFixed(6)));
      w(21, Number(p.y.toFixed(6)));
      w(31, 0.0);

      w(0, "LINE");
      w(8, layer);
      w(10, Number(p.x.toFixed(6)));
      w(20, Number((p.y - r * 0.9).toFixed(6)));
      w(30, 0.0);
      w(11, Number(p.x.toFixed(6)));
      w(21, Number((p.y + r * 0.9).toFixed(6)));
      w(31, 0.0);

      w(0, "LINE");
      w(8, layer);
      w(10, Number((p.x - r * 0.7).toFixed(6)));
      w(20, Number((p.y - r * 0.7).toFixed(6)));
      w(30, 0.0);
      w(11, Number((p.x + r * 0.7).toFixed(6)));
      w(21, Number((p.y + r * 0.7).toFixed(6)));
      w(31, 0.0);

      w(0, "LINE");
      w(8, layer);
      w(10, Number((p.x - r * 0.7).toFixed(6)));
      w(20, Number((p.y + r * 0.7).toFixed(6)));
      w(30, 0.0);
      w(11, Number((p.x + r * 0.7).toFixed(6)));
      w(21, Number((p.y - r * 0.7).toFixed(6)));
      w(31, 0.0);

      continue;
    }

    if (p.circleRadius != null && Number.isFinite(p.circleRadius) && p.circleRadius > 0) {
      w(0, "CIRCLE");
      w(8, layer);
      w(10, Number(p.x).toFixed(6));
      w(20, Number(p.y).toFixed(6));
      w(30, 0.0);
      w(40, Number(p.circleRadius.toFixed(6)));
    }

    const rs = Number.isFinite(p.reactiveShare as number) ? (p.reactiveShare as number) : 0;
    if (rs > 1e-9 && rs <= 1.0 && p.circleRadius && p.circleRadius > 0) {
      const start = -Math.PI / 2;
      const reactiveAngle = Math.max(0, Math.min(1, rs)) * Math.PI * 2;
      const end = start + reactiveAngle;
      const seg = Math.min(64, Math.max(6, Math.ceil((end - start) / (Math.PI / 32))));
      const pts: { x: number; y: number }[] = [];
      pts.push({ x: p.x, y: p.y });
      for (let i = 0; i <= seg; i++) {
        const a = start + (end - start) * (i / seg);
        const px = p.x + p.circleRadius * Math.cos(a);
        const py = p.y + p.circleRadius * Math.sin(a);
        pts.push({ x: px, y: py });
      }
      pts.push({ x: p.x, y: p.y });

      w(0, "POLYLINE");
      w(8, layer);
      w(66, 1);
      w(70, 1);
      for (const v of pts) {
        w(0, "VERTEX");
        w(8, layer);
        w(10, Number(v.x).toFixed(6));
        w(20, Number(v.y).toFixed(6));
        w(30, 0.0);
      }
      w(0, "SEQEND");
    }

    if ((!p.circleRadius || !Number.isFinite(p.circleRadius)) && (!p.reactiveShare || p.reactiveShare <= 0)) {
      w(0, "POINT");
      w(8, layer);
      w(10, Number(p.x).toFixed(6));
      w(20, Number(p.y).toFixed(6));
      w(30, 0.0);
    }
  }

  w(0, "ENDSEC");
  w(0, "EOF");
  return writeDXFLines(lines);
}

export function downloadFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export helper convenient wrapper */
export function exportToDXF(
  objects: PolyObj[],
  options?: {
    includeCircles?: boolean;
    scaleByView?: boolean;
    viewScale?: number;
    filename?: string;
    loadCenter?: { x: number; y: number } | null;
  }
) {
  const includeCircles = !!options?.includeCircles;
  const scaleByView = options?.scaleByView ?? true;
  const viewScale = options?.viewScale ?? 1;
  const filename = options?.filename ?? "centertp-centers.dxf";
  const loadCenter = options?.loadCenter ?? null;

  const parseNum = (s?: string) => {
    if (!s) return NaN;
    const n = parseFloat(String(s).replace(",", ".").replace(/[^\d.\-eE+]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };

  // build bbox to determine logo size
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const o of objects) {
    const c = getOriginalCenter(o);
    if (!c) continue;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  if (loadCenter) {
    minX = Math.min(minX, loadCenter.x);
    minY = Math.min(minY, loadCenter.y);
    maxX = Math.max(maxX, loadCenter.x);
    maxY = Math.max(maxY, loadCenter.y);
  }
  const span = Math.max(1e-6, Math.max(maxX - minX, maxY - minY));
  const logoSizeDefault = Math.max(0.2, Math.min(200, span * 0.02));

  const pts: DXFPoint[] = [];
  for (const o of objects) {
    const c = getOriginalCenter(o);
    if (!c) continue;

    const P = parseNum(o.p_active);
    let Q = parseNum(o.p_reactive);
    const pf = parseNum(o.pf);
    let S = parseNum(o.p_full);
    if (!Number.isFinite(S) && Number.isFinite(P) && Number.isFinite(pf) && pf !== 0) S = P / pf;
    if (!Number.isFinite(Q) && Number.isFinite(P) && Number.isFinite(pf) && pf !== 0) {
      const sq = Math.max(0, 1 - pf * pf);
      const tanphi = Math.sqrt(sq) / pf;
      Q = P * tanphi;
    }
    if (!Number.isFinite(S) && Number.isFinite(P) && Number.isFinite(Q)) S = Math.sqrt(P * P + Q * Q);

    let radius = null as number | null;
    if (includeCircles && Number.isFinite(S) && S > 0) {
      radius = S / 2;
      if (scaleByView) radius = radius * viewScale;
    }

    let reactiveShare = 0;
    if (Number.isFinite(Q) && Number.isFinite(S) && S > 0) reactiveShare = Math.max(0, Math.min(1, Q / S));
    pts.push({ x: c.x, y: c.y, layer: "Plots", circleRadius: radius, reactiveShare });
  }

  if (loadCenter) {
    pts.push({
      x: loadCenter.x,
      y: loadCenter.y,
      layer: "LoadCenter",
      circleRadius: null,
      reactiveShare: 0,
      isLoadCenter: true,
      logoSize: logoSizeDefault,
    });
  }

  if (!pts.length) {
    throw new Error("Нет координат для экспорта.");
  }

  const dxf = makeDXF(pts);
  downloadFile(filename, dxf);
}

/** Utility to compute original center (falls back to polygon centroid) */
export function getOriginalCenter(o: PolyObj): { x: number; y: number } | null {
  if (o.centerOrigX != null && o.centerOrigY != null) {
    return { x: o.centerOrigX, y: o.centerOrigY };
  }
  if (o.origPoints && o.origPoints.length) {
    let sx = 0,
      sy = 0;
    for (const [xx, yy] of o.origPoints) {
      sx += xx;
      sy += yy;
    }
    return { x: sx / o.origPoints.length, y: sy / o.origPoints.length };
  }
  return null;
}
