import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AppHostProps } from "../../utils/types";
import { meta } from "./meta";
import logoUrl from "../../assets/logo.png";
import type { PolyObj, Point } from "./types";
import GeoPreview from "./GeoPreview";
import { exportToDXF, getOriginalCenter } from "./dxf";

export { meta };

const fmt = (v: number | null) => (v === null ? "" : v.toFixed(2).replace(".", ","));

function computeLoadCenter(objs: PolyObj[], requireAllFilled = true) {
  let sumP = 0;
  let sumPx = 0;
  let sumPy = 0;
  let anyEmpty = false;

  for (const o of objs) {
    const raw = (o.p_active ?? "").toString().replace(",", ".").trim();
    if (raw === "") anyEmpty = true;
    const p = raw === "" ? NaN : parseFloat(raw);
    if (!Number.isFinite(p)) continue;

    let cx = o.centerOrigX;
    let cy = o.centerOrigY;
    if ((cx === null || cy === null) && o.origPoints && o.origPoints.length) {
      let sx = 0,
        sy = 0;
      for (const [xx, yy] of o.origPoints) {
        sx += xx;
        sy += yy;
      }
      cx = sx / o.origPoints.length;
      cy = sy / o.origPoints.length;
    }
    if (cx == null || cy == null) continue;

    sumP += p;
    sumPx += p * cx;
    sumPy += p * cy;
  }

  if (requireAllFilled && anyEmpty) return null;
  if (sumP <= 0) return null;
  return { x: sumPx / sumP, y: sumPy / sumP, totalPower: sumP };
}

export default function CenterTP({ className }: AppHostProps) {
  const [objects, setObjects] = useState<PolyObj[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewScale, setViewScale] = useState<number>(1);

  const swapOnImport = true;

  useEffect(() => {
    return () => {};
  }, []);

  const parseLine = (line: string): Point | null => {
    const cleaned = line.replace(/\u00A0/g, " ").trim();
    if (!cleaned) return null;
    const parts = cleaned.split(/\s+/);
    if (parts.length < 2) return null;
    const x = parseFloat(parts[0].replace(",", ".").replace(/[^0-9.\-]/g, ""));
    const y = parseFloat(parts[1].replace(",", ".").replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    return null;
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || "");
      const blocks = text
        .split(/\r?\n/)
        .map((l) => l.replace(/\u00A0/g, " ").trim())
        .join("\n")
        .split(/\n{2,}/g)
        .map((b) => b.trim())
        .filter(Boolean);

      const imported: PolyObj[] = [];
      for (const b of blocks) {
        const lines = b.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const cadastral = lines[0];
        const origPts: Point[] = [];
        for (let i = 1; i < lines.length; i++) {
          const p = parseLine(lines[i]);
          if (p) origPts.push(p);
        }
        let cx = null as number | null,
          cy = null as number | null;
        if (origPts.length) {
          let sx = 0,
            sy = 0;
          for (const [x, y] of origPts) {
            sx += x;
            sy += y;
          }
          cx = sx / origPts.length;
          cy = sy / origPts.length;
        }
        const plotPts = origPts.map(([x, y]) => (swapOnImport ? [y, x] : [x, y]) as Point);
        imported.push({
          cadastral,
          centerOrigX: cx,
          centerOrigY: cy,
          origPoints: origPts,
          plotPoints: plotPts,
          p_active: "",
          p_reactive: "",
          p_full: "",
          pf: "",
        });
      }

      if (!imported.length) {
        setMsg("Файл обработан, но объектов не найдено.");
        return;
      }

      setObjects((cur) => (cur.length === 0 ? imported : [...cur, ...imported]));
      setMsg(`Импортировано ${imported.length} объектов.`);
    };
    r.onerror = () => setMsg("Ошибка чтения файла.");
    r.readAsText(file, "utf-8");
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    handleFile(f);
    e.currentTarget.value = "";
  };

  const removeAt = (i: number) => setObjects((s) => {
    const c = s.slice();
    c.splice(i, 1);
    return c;
  });
  const addEmpty = () => setObjects((s) => [...s, { cadastral: "", centerOrigX: null, centerOrigY: null, origPoints: [], plotPoints: [], p_active: "", p_reactive: "", p_full: "", pf: "" }]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setModalOpen(false);
        setSelectedIndex(null);
      }
    };
    document.addEventListener("keydown", onKey);
    if (modalOpen) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const loadCenter = useMemo(() => computeLoadCenter(objects, true), [objects]);
  const loadCenterPlot = useMemo(() => {
    if (!loadCenter) return null;
    const { x, y } = loadCenter;
    return swapOnImport ? [y, x] as Point : [x, y] as Point;
  }, [loadCenter]);

  const clearAllWithConfirm = () => {
    if (!objects.length) return;
    if (window.confirm(`Очистить все ${objects.length} объектов?`)) {
      setObjects([]);
      setMsg("Все объекты удалены.");
    }
  };

  const decScale = () => setViewScale((s) => Math.max(0.1, +(s - 0.1).toFixed(2)));
  const incScale = () => setViewScale((s) => Math.min(10, +(s + 0.1).toFixed(2)));
  const resetScale = () => setViewScale(1);

  const parseNumberString = (s?: string) => {
    if (s == null) return NaN;
    const cleaned = s.toString().replace(",", ".").trim();
    if (cleaned === "") return NaN;
    const n = parseFloat(cleaned.replace(/[^\d.\-\+eE]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const formatNumberString = (n: number) => {
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2).replace(".", ",");
  };

  const computeSAndQ = (P: number, pf: number) => {
    if (!Number.isFinite(P) || !Number.isFinite(pf)) return { S: NaN, Q: NaN };
    if (pf === 0) return { S: NaN, Q: NaN };
    if (pf <= 0 || Math.abs(pf) > 1.0001) return { S: NaN, Q: NaN };
    const S = P / pf;
    const sq = Math.max(0, 1 - pf * pf);
    const tanphi = Math.sqrt(sq) / pf;
    const Q = P * tanphi;
    return { S, Q };
  };

  const selectedObj = (selectedIndex != null && objects[selectedIndex]) ? objects[selectedIndex] : null;
  let selP = NaN, selQ = NaN, selS = NaN, selPf = NaN;
  if (selectedObj) {
    selP = parseNumberString(selectedObj.p_active);
    selQ = parseNumberString(selectedObj.p_reactive);
    selS = parseNumberString(selectedObj.p_full);
    selPf = parseNumberString(selectedObj.pf);
    if (!Number.isFinite(selS) && Number.isFinite(selP) && Number.isFinite(selPf)) {
      const r = computeSAndQ(selP, selPf); selS = r.S; if (Number.isFinite(r.Q) && !Number.isFinite(selQ)) selQ = r.Q;
    }
    if (!Number.isFinite(selS) && Number.isFinite(selP) && Number.isFinite(selQ)) {
      selS = Math.sqrt(selP * selP + selQ * selQ);
    }
  }

  // small helpers for DXF call
  const handleExportDXF = (opts?: { includeCircles?: boolean; scaleByView?: boolean }) => {
    try {
      const loadCenterObj = loadCenter ? getOriginalCenter({ cadastral: "", centerOrigX: loadCenter.x, centerOrigY: loadCenter.y, origPoints: [], plotPoints: [], p_active: "", p_reactive: "", p_full: "", pf: "" }) : null;
      exportToDXF(objects, {
        includeCircles: opts?.includeCircles ?? true,
        scaleByView: opts?.scaleByView ?? true,
        viewScale,
        filename: "centertp-centers.dxf",
        loadCenter: loadCenter ? { x: loadCenter.x, y: loadCenter.y } : null,
      });
      setMsg("Экспорт выполнен.");
    } catch (err: any) {
      setMsg(String(err?.message ?? err ?? "Ошибка экспорта"));
    }
  };

  return (
    <div className={`p-4 rounded-xl bg-white shadow-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="logo" className="w-12 h-12 object-contain rounded-md" />
          <div>
            <div className="text-lg font-semibold text-sky-700">ЦентрТП — расчёт центра нагрузок</div>
            <div className="text-sm text-gray-500">Импорт текстового реестра, предпросмотр и экспорт в DXF</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md bg-sky-600 text-white font-medium" onClick={() => fileRef.current?.click()}>Импорт (.txt)</button>
          <button className="px-3 py-2 rounded-md border" onClick={() => setModalOpen(true)}>Предпросмотр</button>
          <button className="px-3 py-2 rounded-md border" onClick={() => handleExportDXF({ includeCircles: true, scaleByView: true })}>Экспорт DXF</button>
          {msg && <div className="text-sm text-gray-500 ml-3">{msg}</div>}
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={onFileChange} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-600">
              <th className="pr-4">#</th>
              <th className="pr-4">Кадастр</th>
              <th className="pr-4">Адрес</th>
              <th className="pr-4">X</th>
              <th className="pr-4">Y</th>
              <th className="pr-4">P, кВт</th>
              <th className="pr-4">Q, кВАр</th>
              <th className="pr-4">S, кВА</th>
              <th className="pr-4">cosφ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {objects.map((o, i) => (
              <tr key={i} className="border-t">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.cadastral} onChange={(e) => {
                    const v = e.target.value;
                    setObjects(s => { const c = s.slice(); c[i] = { ...c[i], cadastral: v }; return c; });
                  }} />
                </td>
                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.address ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    setObjects(s => { const c = s.slice(); c[i] = { ...c[i], address: v }; return c; });
                  }} />
                </td>
                <td className="py-2">
                  <input className="w-full bg-transparent" value={fmt(o.centerOrigX)} onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    setObjects(s => { const c = s.slice(); const n = parseFloat(v); c[i] = { ...c[i], centerOrigX: Number.isFinite(n) ? n : null }; return c; });
                  }} />
                </td>
                <td className="py-2">
                  <input className="w-full bg-transparent" value={fmt(o.centerOrigY)} onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    setObjects(s => { const c = s.slice(); const n = parseFloat(v); c[i] = { ...c[i], centerOrigY: Number.isFinite(n) ? n : null }; return c; });
                  }} />
                </td>

                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.p_active ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    setObjects(s => {
                      const c = s.slice();
                      const row = { ...c[i], p_active: v };
                      const Pn = parseNumberString(v);
                      const pfn = parseNumberString(row.pf);
                      if (Number.isFinite(Pn) && Number.isFinite(pfn) && pfn !== 0 && pfn > 0 && Math.abs(pfn) <= 1.0001) {
                        const { S, Q } = computeSAndQ(Pn, pfn);
                        if (Number.isFinite(Q)) row.p_reactive = formatNumberString(Q);
                        if (Number.isFinite(S)) row.p_full = formatNumberString(S);
                      }
                      c[i] = row;
                      return c;
                    });
                  }} />
                </td>

                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.p_reactive ?? ""} onChange={(e) => { const v = e.target.value; setObjects(s => { const c = s.slice(); c[i] = { ...c[i], p_reactive: v }; return c; }); }} />
                </td>

                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.p_full ?? ""} onChange={(e) => { const v = e.target.value; setObjects(s => { const c = s.slice(); c[i] = { ...c[i], p_full: v }; return c; }); }} />
                </td>

                <td className="py-2">
                  <input className="w-full bg-transparent" value={o.pf ?? ""} onChange={(e) => {
                    const v = e.target.value;
                    setObjects(s => {
                      const c = s.slice();
                      const row = { ...c[i], pf: v };
                      const Pn = parseNumberString(row.p_active);
                      const pfn = parseNumberString(v);
                      if (Number.isFinite(Pn) && Number.isFinite(pfn) && pfn !== 0 && pfn > 0 && Math.abs(pfn) <= 1.0001) {
                        const { S, Q } = computeSAndQ(Pn, pfn);
                        if (Number.isFinite(Q)) row.p_reactive = formatNumberString(Q);
                        if (Number.isFinite(S)) row.p_full = formatNumberString(S);
                      }
                      c[i] = row;
                      return c;
                    });
                  }} />
                </td>

                <td className="py-2 text-center">
                  <button className="w-10 h-10 bg-red-500 text-white rounded-md" onClick={() => removeAt(i)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">Объектов: {objects.length}</div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-md bg-green-600 text-white" onClick={addEmpty}>Добавить</button>
          <button className="px-3 py-2 rounded-md border" onClick={clearAllWithConfirm}>Очистить всё</button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold text-sky-700">Предпросмотр участков</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-gray-50 rounded p-2">
                  <button onClick={decScale} className="px-2">−</button>
                  <input type="range" min={0.1} max={10} step={0.1} value={viewScale} onChange={(e) => setViewScale(parseFloat(e.target.value))} />
                  <button onClick={incScale} className="px-2">+</button>
                </div>
                <label className="text-sm">
                  <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="mr-2" />
                  Кадастровые
                </label>
                <button className="px-3 py-1 border rounded" onClick={() => { setModalOpen(false); setSelectedIndex(null); }}>Закрыть</button>
              </div>
            </div>

            <div className="flex gap-4 p-4" style={{ height: 520 }}>
              <div className="flex-1 bg-slate-50 rounded p-2">
                <GeoPreview
                  width={1000}
                  height={480}
                  objects={objects}
                  showLabels={showLabels}
                  invertY={true}
                  loadCenterPlot={loadCenterPlot}
                  swapOnImport={swapOnImport}
                  viewScale={viewScale}
                  selectedIndex={selectedIndex}
                  onSelect={(idx) => setSelectedIndex(idx)}
                />
              </div>

              <div style={{ width: 320 }} className="p-3">
                <div className="font-semibold mb-2">Информация</div>
                {!selectedObj ? (
                  <div className="text-sm text-gray-500">Нажмите на участок, чтобы увидеть данные.</div>
                ) : (
                  <div className="text-sm text-gray-700 space-y-2">
                    <div><strong>Кадастр:</strong> {selectedObj.cadastral || "—"}</div>
                    <div><strong>Адрес:</strong> {selectedObj.address || "—"}</div>
                    <div><strong>P:</strong> {Number.isFinite(selP) ? `${formatNumberString(selP)} кВт` : "—"}</div>
                    <div><strong>Q:</strong> {Number.isFinite(selQ) ? `${formatNumberString(selQ)} кВАр` : "—"}</div>
                    <div><strong>S:</strong> {Number.isFinite(selS) ? `${formatNumberString(selS)} кВА` : "—"}</div>
                    <div><strong>cosφ:</strong> {Number.isFinite(selPf) ? selPf.toFixed(3).replace(".", ",") : (selectedObj.pf ?? "—")}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
