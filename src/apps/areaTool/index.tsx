// src/apps/areaTool/index.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AppHostProps } from "../../utils/types";
import { meta } from "./meta";
import * as Icons from "lucide-react";

// Vite-safe URL import for the .docx assets
const templateUrl = new URL("../../assets/letter_template.docx", import.meta.url).href;
const contractTemplateUrl = new URL("../../assets/contract_template.docx", import.meta.url).href;

type Point = [number, number];
type Contour = Point[];

/* ------------------------- Parsing & Geometry ------------------------- */

function normalizeNumberSeparators(s: string) {
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

function parseMulticontours(text: string): Contour[] {
  const blocks: Contour[] = [];
  let curr: Contour = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (line === "") {
      if (curr.length) {
        blocks.push(curr);
        curr = [];
      }
      return;
    }
    const norm = normalizeNumberSeparators(line);
    const parts = norm.replace(/\t+/g, " ").trim().split(/\s+/);
    if (parts.length < 2) return;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error(`Неверный формат числа в строке ${idx + 1}: '${raw}'`);
    }
    curr.push([a, b]);
  });
  if (curr.length) blocks.push(curr);
  return blocks;
}

function isClosed(points: Contour) {
  if (points.length < 2) return false;
  const [x0, y0] = points[0];
  const [xn, yn] = points[points.length - 1];
  return Math.abs(x0 - xn) < 1e-9 && Math.abs(y0 - yn) < 1e-9;
}

function shoelaceArea(points: Contour): number {
  if (points.length < 4) throw new Error("Недостаточно точек для замкнутого контура.");
  if (!isClosed(points)) throw new Error("Контур не замкнут.");
  let s = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(0.5 * s);
}

/* ------------------------- Normalization ------------------------- */

function normalizeContoursForCanvas(contours: Contour[], baseW = 1000, baseH = 700, padding = 24) {
  const xs = contours.flat().map((p) => p[0]);
  const ys = contours.flat().map((p) => p[1]);
  if (!xs.length || !ys.length) {
    return { w: baseW, h: baseH, padding, transformed: [] as Contour[], bbox: { minx: 0, miny: 0, maxx: 1, maxy: 1 } };
  }
  const minx = Math.min(...xs);
  const maxx = Math.max(...xs);
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);
  const w = Math.max(1, maxx - minx);
  const h = Math.max(1, maxy - miny);

  const scale = Math.min((baseW - 2 * padding) / w, (baseH - 2 * padding) / h);

  const transformed = contours.map((c) =>
    c.map(([x, y]) => {
      const tx = (x - minx) * scale + padding;
      const ty = baseH - ((y - miny) * scale + padding);
      return [tx, ty] as Point;
    })
  );

  return { w: baseW, h: baseH, padding, transformed, bbox: { minx, miny, maxx, maxy } };
}

/* ------------------------- Helpers for money and text ------------------------- */

function formatNumberWithSpaces(n: number, decimals = 2) {
  const parts = n.toFixed(decimals).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}

function roundTo2(n: number) {
  return Math.round(n * 100) / 100;
}

// Convert integer number to words (without currency), supports up to billions reasonably
function integerToWords(n: number) {
  if (n === 0) return "ноль";

  const ones = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять"];
  const onesFemale = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять"];
  const teens = ["десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
  const tens = ["","десять","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
  const hundreds = ["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];

  const orders: Array<{ female?: boolean; singular?: string; few?: string; many?: string }> = [
    { }, // units
    { female: true, singular: "тысяча", few: "тысячи", many: "тысяч" },
    { singular: "миллион", few: "миллиона", many: "миллионов" },
    { singular: "миллиард", few: "миллиарда", many: "миллиардов" },
  ];

  function triadToWords(num: number, orderIdx: number) {
    const out: string[] = [];
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    if (h) out.push(hundreds[h]);
    if (t > 1) {
      out.push(tens[t]);
      if (o) out.push((orders[orderIdx]?.female ? onesFemale : ones)[o]);
    } else if (t === 1) {
      out.push(teens[o]);
    } else {
      if (o) out.push((orders[orderIdx]?.female ? onesFemale : ones)[o]);
    }
    return out;
  }

  function pluralForm(num: number, desc?: { singular?: string; few?: string; many?: string }) {
    if (!desc) return "";
    const n10 = num % 10;
    const n100 = num % 100;
    if (n10 === 1 && n100 !== 11) return desc.singular ?? "";
    if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return desc.few ?? "";
    return desc.many ?? "";
  }

  let rem = n;
  const parts: string[] = [];
  let order = 0;
  while (rem > 0) {
    const triad = rem % 1000;
    if (triad) {
      const words = triadToWords(triad, order);
      const orderWord = order > 0 ? pluralForm(triad, orders[order]) : "";
      parts.unshift(...(words.length ? [...words, orderWord].filter(Boolean) : []));
    }
    rem = Math.floor(rem / 1000);
    order++;
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// Prepare rubles words (without the word 'рубль/рублей') and kopecks two-digit string
function amountToWordsParts(amount: number) {
  const rounded = roundTo2(amount);
  const rub = Math.floor(rounded);
  const kop = Math.round((rounded - rub) * 100);

  const rubWords = integerToWords(rub);
  const kopStr = kop.toString().padStart(2, "0");
  return { rub, kop, rubWords, kopStr };
}

// parse money-like strings to number safely
function safeParseMoney(s: string) {
  if (!s) return 0;
  const cleaned = s.toString().replace(/\s+/g, "").replace(/,/g, ".");
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

/* ------------------------- Dynamic petrovich loader & fallbacks ------------------------- */

let PETROVICH_INSTANCE: any | null = null;
async function ensurePetrovich() {
  if (PETROVICH_INSTANCE !== null) return PETROVICH_INSTANCE;
  try {
    // Try dynamic import; module shape may vary so handle different exports
    const mod: any = await import("petrovich");
    const PetrovichClass = mod?.Petrovich ?? mod?.default?.Petrovich ?? mod?.default ?? mod;
    // If mod itself is a factory/class, wrap appropriately:
    if (typeof PetrovichClass === "function") {
      PETROVICH_INSTANCE = new PetrovichClass();
    } else if (mod?.Petrovich && typeof mod.Petrovich === "function") {
      PETROVICH_INSTANCE = new mod.Petrovich();
    } else if (mod?.default && typeof mod.default === "function") {
      PETROVICH_INSTANCE = new mod.default();
    } else {
      PETROVICH_INSTANCE = null;
    }
    return PETROVICH_INSTANCE;
  } catch (e) {
    // библиотека не установлена / импорт не удался — используем эвристику
    console.warn("petrovich import failed or not installed, falling back to heuristics", e);
    PETROVICH_INSTANCE = null;
    return null;
  }
}

// Fallback heuristics (previous simple implementations) — используются если petrovich не доступен
function surnameToGenitiveFallback(s: string) {
  if (!s) return s;
  if (/^[A-Za-z0-9\s\-]+$/.test(s)) return s;
  s = s.trim();
  if (/ий$/i.test(s)) return s.replace(/ий$/i, "ого");
  if (/ой$/i.test(s)) return s.replace(/ой$/i, "ого");
  if (/ая$/i.test(s)) return s.replace(/ая$/i, "ой");
  if (/я$/i.test(s)) return s.replace(/я$/i, "и");
  if (/а$/i.test(s)) return s.replace(/а$/i, "ы");
  if (/ь$/i.test(s)) return s.replace(/ь$/i, "я");
  return s + "а";
}
function nameToGenitiveFallback(name: string) {
  if (!name) return name;
  if (/^[A-Za-z0-9\s\-]+$/.test(name)) return name;
  name = name.trim();
  if (/й$/i.test(name)) return name.replace(/й$/i, "я");
  if (/а$/i.test(name)) return name.replace(/а$/i, "ы");
  if (/я$/i.test(name)) return name.replace(/я$/i, "и");
  return name + "а";
}
function patronymicToGenitiveFallback(pat: string) {
  if (!pat) return pat;
  if (/^[A-Za-z0-9\s\-]+$/.test(pat)) return pat;
  pat = pat.trim();
  if (/ич$/i.test(pat)) return pat.replace(/ич$/i, "ича");
  if (/на$/i.test(pat)) return pat.replace(/на$/i, "ны");
  if (/а$/i.test(pat)) return pat.replace(/а$/i, "ы");
  return pat + "а";
}

// position fallback (roditive) - simple heuristic
function positionToGenitiveFallback(pos: string) {
  if (!pos) return pos;
  pos = pos.trim();
  if (/^[A-Za-z0-9\s\-\.,]+$/.test(pos)) return pos;
  const words = pos.split(/\s+/);
  if (words.length === 1) {
    const w = words[0];
    if (/ий$/i.test(w)) return w.replace(/ий$/i, "ого");
    if (/ой$/i.test(w)) return w.replace(/ой$/i, "ого");
    if (/а$/i.test(w)) return w.replace(/а$/i, "ы");
    if (/я$/i.test(w)) return w.replace(/я$/i, "и");
    if (/ь$/i.test(w)) return w.replace(/ь$/i, "я");
    if (/й$/i.test(w)) return w.replace(/й$/i, "я");
    return w + "а";
  }
  const last = words[words.length - 1];
  const rest = words.slice(0, words.length - 1);
  const restTransformed = rest.map((w) => {
    if (/ый$/i.test(w) || /ий$/i.test(w) || /ой$/i.test(w)) return w.replace(/(ый|ий|ой)$/i, "ого");
    if (/ая$/i.test(w)) return w.replace(/ая$/i, "ой");
    if (/ое$/i.test(w)) return w.replace(/ое$/i, "ого");
    if (/ые$/i.test(w) || /ие$/i.test(w)) return w.replace(/(ые|ие)$/i, "ых");
    return w;
  });
  let lastTrans = last;
  if (/ий$/i.test(last)) lastTrans = last.replace(/ий$/i, "ого");
  else if (/ой$/i.test(last)) lastTrans = last.replace(/ой$/i, "ого");
  else if (/а$/i.test(last)) lastTrans = last.replace(/а$/i, "ы");
  else if (/я$/i.test(last)) lastTrans = last.replace(/я$/i, "и");
  else if (/ь$/i.test(last)) lastTrans = last.replace(/ь$/i, "я");
  else if (/й$/i.test(last)) lastTrans = last.replace(/й$/i, "я");
  else lastTrans = last + "а";
  return [...restTransformed, lastTrans].join(" ");
}

/* ------------------------- Initials formatting ------------------------- */

function formatInitialsThenSurname(full: string) {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  if (parts.length >= 3) {
    const surname = parts[0];
    const name = parts[1];
    const patronymic = parts[2];
    const initials = `${(name[0] || "").toUpperCase()}.${(patronymic[0] || "").toUpperCase()}.`;
    return `${initials} ${surname}`;
  } else if (parts.length === 2) {
    const surname = parts[0];
    const name = parts[1];
    const initials = `${(name[0] || "").toUpperCase()}.`;
    return `${initials} ${surname}`;
  } else {
    return parts[0] ?? "";
  }
}

/* ------------------------- Component ------------------------- */

export default function AreaTool({ className, onClose }: AppHostProps) {
  const [text, setText] = useState<string>("");
  const [contours, setContours] = useState<Contour[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alwaysYFirst, setAlwaysYFirst] = useState<boolean>(true);
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});
  const [pricePerHa, setPricePerHa] = useState<string>("");
  const [activeContourIdx, setActiveContourIdx] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const [hoveredContourIdx, setHoveredContourIdx] = useState<number | null>(null);

  // Letter modal state + form
  const [isLetterOpen, setIsLetterOpen] = useState<boolean>(false);
  const [letterForm, setLetterForm] = useState<Record<string, string>>({
    manager_position: "",
    manager_gender: "male",
    company_short_name: "",
    surname_initials: "",
    legal_address: "",
    email: "",
    first_name_and_patronymic: "",
    case_number: "",
    price_per_hectare: "",
    executor_position: "",
    executor_fio: "",
    executor_number: "",
    executor_email: "",
  });

  // Contract modal state + form (independent from letter and calculations)
  const [isContractOpen, setIsContractOpen] = useState<boolean>(false);
  const [contractForm, setContractForm] = useState<Record<string, string>>({
    company_full_name: "",
    manager_position: "",
    manager_fio: "",
    object_address: "",
    contract_price: "", // raw user input (sum including VAT)
    company_short_name: "",
    legal_address: "",
    customer_contact_number: "",
    email: "",
    "INN/KPP": "",
    OGRN: "",
    bank_name: "",
    current_account: "",
    correspondent_account: "",
    BIC: "",
    area_hectares: "", // required
    price_hectare: "", // required (with VAT)
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const parsedContours = useMemo(() => {
    try {
      const parsed = parseMulticontours(text).map((c) =>
        c.map(([a, b]) => (alwaysYFirst ? [b, a] as Point : [a, b] as Point))
      );
      setError(null);
      return parsed;
    } catch (e: any) {
      setError(e.message || String(e));
      return [];
    }
  }, [text, alwaysYFirst]);

  useEffect(() => {
    setContours(parsedContours);
    const sel: Record<number, boolean> = {};
    parsedContours.forEach((c, idx) => {
      sel[idx] = isClosed(c);
    });
    setSelectedIndices(sel);
    setActiveContourIdx(parsedContours.length ? 0 : null);

    setTimeout(() => {
      resetViewToFit(parsedContours);
    }, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedContours]);

  function computeTotals() {
    let totalM2 = 0;
    let closed = 0;
    let included = 0;
    contours.forEach((c, idx) => {
      if (isClosed(c)) {
        closed++;
        if (selectedIndices[idx]) {
          try {
            const a = shoelaceArea(c);
            totalM2 += a;
            included++;
          } catch {}
        }
      }
    });
    return { totalM2, totalHa: totalM2 / 10000, closed, included };
  }
  const totals = computeTotals();

  const normalized = useMemo(() => normalizeContoursForCanvas(contours), [contours]);

  /* ------------------------- Interaction utils ------------------------- */

  const clampScale = (s: number) => Math.max(0.1, Math.min(8, s));

  function screenToCanvas(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const x = (cx - translate.x) / scale;
    const y = (cy - translate.y) / scale;
    return { x, y };
  }

  function handleWheel(e: { deltaY: number; clientX: number; clientY: number; preventDefault?: () => void }) {
    e.preventDefault?.();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.12 : 0.88;
    const newScale = clampScale(scale * factor);

    const svg = svgRef.current;
    if (!svg) {
      setScale(newScale);
      return;
    }
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - translate.x) / scale;
    const worldY = (mouseY - translate.y) / scale;

    const newTx = mouseX - worldX * newScale;
    const newTy = mouseY - worldY * newScale;
    setScale(newScale);
    setTranslate({ x: newTx, y: newTy });
  }

  function handleWheelCapture(e: React.WheelEvent) {
    e.preventDefault();
    handleWheel(e as unknown as { deltaY: number; clientX: number; clientY: number; preventDefault?: () => void });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    dragState.current.dragging = true;
    dragState.current.startX = e.clientX;
    dragState.current.startY = e.clientY;
    dragState.current.origX = translate.x;
    dragState.current.origY = translate.y;
    (e.target as Element).setPointerCapture?.((e as unknown as any).pointerId || 1);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragState.current.dragging) {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setTranslate({ x: dragState.current.origX + dx, y: dragState.current.origY + dy });
      setHoveredPoint(null);
    } else {
      const svg = svgRef.current;
      if (!svg) return;
      const { x: mx, y: my } = screenToCanvas(e.clientX, e.clientY);
      const tol = 8 / scale;
      let found: { x: number; y: number } | null = null;
      const n = normalized;
      for (const c of n.transformed) {
        for (const [px, py] of c) {
          const dx = px - mx;
          const dy = py - my;
          if (Math.hypot(dx, dy) <= tol) {
            found = { x: px, y: py };
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        setHoveredPoint({ x: found.x, y: found.y, clientX: e.clientX, clientY: e.clientY });
      } else {
        setHoveredPoint(null);
      }
    }
  }

  function handleMouseUp() {
    dragState.current.dragging = false;
  }

  function handleDoubleClick() {
    resetViewToFit(contours);
  }

  function zoomBy(factor: number) {
    const centerX = (normalized.w || 1000) / 2;
    const centerY = (normalized.h || 700) / 2;
    const newScale = clampScale(scale * factor);
    const newTx = centerX - (centerX - translate.x) * (newScale / scale);
    const newTy = centerY - (centerY - translate.y) * (newScale / scale);
    setScale(newScale);
    setTranslate({ x: newTx, y: newTy });
  }

  function resetViewToFit(targetContours: Contour[]) {
    const n = normalizeContoursForCanvas(targetContours);
    const container = canvasRef.current;
    if (!container) {
      setTranslate({ x: 0, y: 0 });
      setScale(1);
      return;
    }
    const cr = container.getBoundingClientRect();
    const s = Math.min((cr.width - 40) / (n.w || 1), (cr.height - 40) / (n.h || 1));
    const newScale = clampScale(s);
    const tx = (cr.width - (n.w || 1) * newScale) / 2;
    const ty = (cr.height - (n.h || 1) * newScale) / 2;
    setScale(newScale);
    setTranslate({ x: tx, y: ty });
  }

  function fitToView() {
    const container = canvasRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const viewW = normalized.w;
    const viewH = normalized.h;
    const pad = 40;
    const s = Math.min((cr.width - pad) / viewW, (cr.height - pad) / viewH);
    const newScale = clampScale(s);
    const tx = (cr.width - viewW * newScale) / 2;
    const ty = (cr.height - viewH * newScale) / 2;
    setScale(newScale);
    setTranslate({ x: tx, y: ty });
  }

  /* ------------------------- Actions ------------------------- */

  function processTextNow() {
    try {
      const parsed = parseMulticontours(text).map((c) => (alwaysYFirst ? c.map(([a, b]) => [b, a] as Point) : c.map(([a, b]) => [a, b] as Point)));
      setContours(parsed);
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  function toggleSelected(idx: number) {
    setSelectedIndices((s) => ({ ...s, [idx]: !s[idx] }));
  }

  function focusContour(idx: number) {
    setActiveContourIdx(idx);
    if (!normalized.transformed[idx]) return;
    const c = normalized.transformed[idx];
    const xs = c.map((p) => p[0]);
    const ys = c.map((p) => p[1]);
    const minx = Math.min(...xs);
    const maxx = Math.max(...xs);
    const miny = Math.min(...ys);
    const maxy = Math.max(...ys);
    const cw = maxx - minx || 1;
    const ch = maxy - miny || 1;
    const container = canvasRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const desiredScale = clampScale(Math.min(6, Math.max(0.2, Math.min((cr.width * 0.6) / cw, (cr.height * 0.6) / ch))));
    const cx = (minx + maxx) / 2;
    const cy = (miny + maxy) / 2;
    const tx = cr.width / 2 - cx * desiredScale;
    const ty = cr.height / 2 - cy * desiredScale;
    setScale(desiredScale);
    setTranslate({ x: tx, y: ty });
  }

  function handleTxtFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || "");
      setText(content);
      setTimeout(() => processTextNow(), 50);
    };
    reader.readAsText(file, "utf-8");
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const wheelHandler = (ev: WheelEvent) => {
      ev.preventDefault();
      handleWheel({
        deltaY: ev.deltaY,
        clientX: ev.clientX,
        clientY: ev.clientY,
        preventDefault: () => ev.preventDefault(),
      });
    };
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheelHandler as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, translate, svgRef.current, canvasRef.current]);

  /* ------------------------- Word document generation ------------------------- */

  async function generateDocxFromTemplate(templateUrlLocal: string, data: Record<string, string>, filename: string): Promise<void> {
    try {
      const PizZipModule = await import(/* webpackChunkName: "pizzip" */ "pizzip");
      const DocxtemplaterModule = await import(/* webpackChunkName: "docxtemplater" */ "docxtemplater");
      const FileSaverModule = await import(/* webpackChunkName: "file-saver" */ "file-saver");

      const PizZip = ((PizZipModule as any).default ?? (PizZipModule as any)) as any;
      const Docxtemplater = ((DocxtemplaterModule as any).default ?? (DocxtemplaterModule as any)) as any;
      const saveAs = ((FileSaverModule as any).saveAs ?? (FileSaverModule as any).default ?? (FileSaverModule as any)) as any;

      const resp = await fetch(templateUrlLocal);
      const arrayBuffer = await resp.arrayBuffer();

      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

      doc.setData(data);
      try {
        doc.render();
      } catch (err: any) {
        console.error("Docxtemplater render error:", err);
        throw new Error(err?.message || "Ошибка при заполнении шаблона");
      }

      const out = doc.getZip().generate({ type: "blob" });
      saveAs(out, filename);
    } catch (e: any) {
      console.error(e);
      alert(
        "Не удалось сгенерировать документ. Убедитесь, что зависимости установлены: npm i pizzip docxtemplater file-saver — и что шаблон находится в src/assets"
      );
    }
  }

  async function generateLetter(templateUrlLocal: string, data: Record<string, string>): Promise<void> {
    const filename = `letter-${(data.case_number || "").replace(/[^0-9A-Za-z-_]/g, "_")}.docx`;
    await generateDocxFromTemplate(templateUrlLocal, data, filename);
  }

  async function generateContract(templateUrlLocal: string, data: Record<string, string>): Promise<void> {
    const safeName = (data.company_short_name || "contract").replace(/[^0-9A-Za-z-_А-Яа-яЁё ]/g, "_");
    const filename = `contract-${safeName}.docx`;
    await generateDocxFromTemplate(templateUrlLocal, data, filename);
  }

  function openLetterModal(): void {
    setLetterForm((s: Record<string, string>) => ({ ...s, price_per_hectare: pricePerHa || s.price_per_hectare }));
    setIsLetterOpen(true);
  }

  function openContractModal(): void {
    setIsContractOpen(true);
  }

  function handleLetterInput(key: string, value: string): void {
    setLetterForm((s: Record<string, string>) => ({ ...s, [key]: value }));
  }

  function handleContractInput(key: string, value: string): void {
    setContractForm((s: Record<string, string>) => ({ ...s, [key]: value }));
  }

  function submitLetterForm(e?: React.FormEvent): void {
    e?.preventDefault();
    const data = { ...letterForm } as Record<string, string>;
    const gender = (data.manager_gender || "male").toString();
    data.ending = gender === "female" ? "ая" : "ый";
    delete data.manager_gender;
    for (const k of Object.keys(data)) if (!data[k]) data[k] = " ";
    generateLetter(templateUrl, data);
    setIsLetterOpen(false);
  }

  // Prepare data for contract template — uses ONLY contractForm (and helper funcs)
  async function prepareContractData(): Promise<Record<string, string>> {
    const data: Record<string, string> = {};

    // Validate required manual fields: area_hectares and price_hectare (they must be present and > 0)
    const areaVal = Number((contractForm.area_hectares || "").toString().replace(",", "."));
    const priceHaValRaw = safeParseMoney(contractForm.price_hectare || "");
    if (!contractForm.area_hectares || isNaN(areaVal) || areaVal <= 0) {
      throw new Error("Поле 'Площадь (га)' обязательно и должно быть положительным числом.");
    }
    if (!contractForm.price_hectare || isNaN(priceHaValRaw) || priceHaValRaw <= 0) {
      throw new Error("Поле 'Цена за 1 га (включая НДС)' обязательно и должно быть положительным числом.");
    }

    // contract price may or may not be provided; if provided we calculate NDS and words; if not - leave blank
    const raw = (contractForm.contract_price || "").toString().trim();
    const total = raw ? safeParseMoney(raw) : 0;
    const hasTotal = total > 0;

    let nds = 0;
    if (hasTotal) {
      nds = roundTo2(total / 6); // VAT = total * 20/120 = total / 6
    }

    const totalRounded = roundTo2(total);
    const totalFormatted = hasTotal ? formatNumberWithSpaces(totalRounded, 2) : " ";
    const ndsFormatted = hasTotal ? formatNumberWithSpaces(nds, 2) : " ";

    if (hasTotal) {
      const totalParts = amountToWordsParts(totalRounded);
      const ndsParts = amountToWordsParts(nds);

      const totalRublesFormattedNoCents = formatNumberWithSpaces(totalParts.rub, 0);
      const ndsRublesFormattedNoCents = formatNumberWithSpaces(ndsParts.rub, 0);

      data.contract_price_full = `${totalRublesFormattedNoCents} (${totalParts.rubWords}) рублей ${totalParts.kopStr} копеек, в том числе НДС 20% ${ndsRublesFormattedNoCents} (${ndsParts.rubWords}) рублей ${ndsParts.kopStr} копеек`;
    } else {
      data.contract_price_full = " ";
    }

    // Try to use petrovich for name/fio genitive if available
    const pv = await ensurePetrovich();

    const fullFio = contractForm.manager_fio || "";
    let manager_fio_rp = "";
    let initials_and_surname = "";
    let initials_and_surname_rp = "";

    if (pv) {
      try {
        // pv API: lastname, firstname, middlename
        const parts = fullFio.trim().split(/\s+/);
        if (parts.length >= 3) {
          const [surname, name, patronymic] = parts;
          const surnameRp = pv.lastname(surname, "gen");
          const nameRp = pv.firstname(name, "gen");
          const patronymicRp = pv.middlename(patronymic, "gen");
          manager_fio_rp = `${surnameRp} ${nameRp} ${patronymicRp}`;

          // initials like И.И. Фамилия
          initials_and_surname = `${(name[0] || "").toUpperCase()}.${(patronymic[0] || "").toUpperCase()}. ${surname}`;
          initials_and_surname_rp = `${(name[0] || "").toUpperCase()}.${(patronymic[0] || "").toUpperCase()}. ${pv.lastname(surname, "gen")}`;
        } else if (parts.length === 2) {
          const [surname, name] = parts;
          const surnameRp = pv.lastname(surname, "gen");
          const nameRp = pv.firstname(name, "gen");
          manager_fio_rp = `${surnameRp} ${nameRp}`;
          initials_and_surname = `${(name[0] || "").toUpperCase()}. ${surname}`;
          initials_and_surname_rp = `${(name[0] || "").toUpperCase()}. ${pv.lastname(surname, "gen")}`;
        } else if (parts.length === 1 && parts[0]) {
          manager_fio_rp = pv.lastname(parts[0], "gen");
          initials_and_surname = parts[0];
          initials_and_surname_rp = pv.lastname(parts[0], "gen");
        }
      } catch (e) {
        // если petrovich неожиданно упадёт — fallback
        manager_fio_rp = fullNameToGenitiveFallback(fullFio);
        initials_and_surname = formatInitialsThenSurname(fullFio);
        initials_and_surname_rp = initialsThenSurnameGenitiveFallback(fullFio);
      }
    } else {
      // fallback heuristics
      manager_fio_rp = fullNameToGenitiveFallback(fullFio);
      initials_and_surname = formatInitialsThenSurname(fullFio);
      initials_and_surname_rp = initialsThenSurnameGenitiveFallback(fullFio);
    }

    // position in genitive (we keep fallback heuristic; petrovich does not handle job titles)
    const manager_position_rp = positionToGenitiveFallback(contractForm.manager_position || "");

    const areaHaStr = areaVal.toFixed(4);
    const priceHaStr = formatNumberWithSpaces(priceHaValRaw, 2);

    data.company_full_name = contractForm.company_full_name || " ";
    data.manager_position = contractForm.manager_position || " ";
    data.manager_fio = contractForm.manager_fio || " ";
    data.object_address = contractForm.object_address || " ";
    data.company_short_name = contractForm.company_short_name || " ";
    data.legal_address = contractForm.legal_address || " ";
    data.customer_contact_number = contractForm.customer_contact_number || " ";
    data.email = contractForm.email || " ";
    data["INN/KPP"] = contractForm["INN/KPP"] || " ";
    data.OGRN = contractForm.OGRN || " ";
    data.bank_name = contractForm.bank_name || " ";
    data.current_account = contractForm.current_account || " ";
    data.correspondent_account = contractForm.correspondent_account || " ";
    data.BIC = contractForm.BIC || " ";
    data.initials_and_surname = initials_and_surname || " ";
    data.initials_and_surname_rp = initials_and_surname_rp || " ";
    data.manager_fio_rp = manager_fio_rp || " ";
    data.manager_position_rp = manager_position_rp || " ";
    data.area_hectares = areaHaStr;
    data.price_hectare = priceHaStr;
    data.contract_price = hasTotal ? totalFormatted : " ";
    data.NDS = hasTotal ? ndsFormatted : " ";

    // Ensure all expected keys exist (avoid docxtemplater errors)
    const requiredKeys = [
      "company_full_name",
      "manager_position",
      "manager_fio",
      "object_address",
      "contract_price_full",
      "company_short_name",
      "legal_address",
      "customer_contact_number",
      "email",
      "INN/KPP",
      "OGRN",
      "bank_name",
      "current_account",
      "correspondent_account",
      "BIC",
      "initials_and_surname",
      "initials_and_surname_rp",
      "manager_fio_rp",
      "manager_position_rp",
      "area_hectares",
      "price_hectare",
      "contract_price",
      "NDS",
    ];
    for (const k of requiredKeys) {
      if (!data[k]) data[k] = " ";
    }

    return data;
  }

  // helper fallbacks for earlier functions used above
  function fullNameToGenitiveFallback(full: string) {
    if (!full) return full;
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return surnameToGenitiveFallback(parts[0]);
    if (parts.length === 2) {
      const [surname, name] = parts;
      return `${surnameToGenitiveFallback(surname)} ${nameToGenitiveFallback(name)}`;
    }
    const [surname, name, patronymic] = parts;
    return `${surnameToGenitiveFallback(surname)} ${nameToGenitiveFallback(name)} ${patronymicToGenitiveFallback(patronymic)}`;
  }
  function initialsThenSurnameGenitiveFallback(full: string) {
    if (!full) return "";
    const parts = full.trim().split(/\s+/);
    if (parts.length >= 3) {
      const [surname, name, patronymic] = parts;
      const initials = `${(name[0] || "").toUpperCase()}.${(patronymic[0] || "").toUpperCase()}.`;
      return `${initials} ${surnameToGenitiveFallback(surname)}`;
    } else if (parts.length === 2) {
      const [surname, name] = parts;
      const initials = `${(name[0] || "").toUpperCase()}.`;
      return `${initials} ${surnameToGenitiveFallback(surname)}`;
    } else {
      return surnameToGenitiveFallback(parts[0]);
    }
  }

  async function submitContractForm(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      const data = await prepareContractData();
      await generateContract(contractTemplateUrl, data);
      setIsContractOpen(false);
    } catch (err: any) {
      alert(err?.message || String(err));
    }
  }

  /* --- block page scroll when modal is open and allow Escape to close --- */
  useEffect(() => {
    if (!isLetterOpen && !isContractOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setIsLetterOpen(false);
        setIsContractOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isLetterOpen, isContractOpen]);

  /* ------------------------- Render ------------------------- */

  return (
    <div className={`p-4 rounded-2xl ${className ?? ""} bg-white dark:bg-gray-800`}>
      <div className="flex gap-6">
        {/* Left: Interactive Canvas */}
        <div className="flex-1 relative" ref={canvasRef}>
          <div className="absolute z-20 top-4 left-4 flex items-center gap-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-md p-1 shadow">
            <button onClick={() => zoomBy(1.2)} title="Zoom in" className="p-2 rounded hover:bg-white/60">
              <Icons.ZoomIn size={16} />
            </button>
            <button onClick={() => zoomBy(0.8)} title="Zoom out" className="p-2 rounded hover:bg-white/60">
              <Icons.ZoomOut size={16} />
            </button>
            <button onClick={() => fitToView()} title="Fit to view" className="p-2 rounded hover:bg-white/60">
              <Icons.Maximize2 size={16} />
            </button>
            <button
              onClick={() => {
                setScale(1);
                setTranslate({ x: 0, y: 0 });
              }}
              title="Reset view"
              className="p-2 rounded hover:bg-white/60"
            >
              <Icons.RotateCw size={16} />
            </button>
          </div>

          <div className="absolute z-20 top-4 right-4 bg-white/80 dark:bg-gray-900/80 rounded px-3 py-1 text-sm shadow">
            <strong>{(scale * 100).toFixed(0)}%</strong>
          </div>

          <div
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              dragState.current.dragging = false;
              setHoveredPoint(null);
            }}
            onWheelCapture={handleWheelCapture}
            style={{ height: "720px", borderRadius: 12, overflow: "hidden", background: "linear-gradient(180deg,#f8fbff,#ffffff)", touchAction: "none" }}
            className="border"
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`0 0 ${normalized.w} ${normalized.h}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "block", userSelect: "none" }}
            >
              <rect x={0} y={0} width={normalized.w} height={normalized.h} fill="transparent" />

              <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
                {normalized.transformed.map((c, ci) => {
                  const closed = isClosed(contours[ci]);
                  const pointsAttr = c.map((p) => p.join(",")).join(" ");
                  const isActive = activeContourIdx === ci;
                  const isHovered = hoveredContourIdx === ci;
                  const included = !!selectedIndices[ci];
                  return (
                    <g
                      key={ci}
                      onMouseEnter={() => setHoveredContourIdx(ci)}
                      onMouseLeave={() => setHoveredContourIdx((s) => (s === ci ? null : s))}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setActiveContourIdx(ci);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <polygon
                        points={pointsAttr}
                        fill={included ? "rgba(10,102,214,0.12)" : "rgba(120,120,120,0.03)"}
                        stroke={isActive ? "#0a66d6" : isHovered ? "#2b8cff" : closed ? "#0a66d6" : "#c0362c"}
                        strokeWidth={isActive ? 2.8 / Math.max(0.0001, scale) : closed ? 1.6 / Math.max(0.0001, scale) : 1.2 / Math.max(0.0001, scale)}
                        strokeLinejoin="round"
                      />
                      {c.map(([x, y], pi) => (
                        <circle
                          key={pi}
                          cx={x}
                          cy={y}
                          r={4 / Math.max(0.0001, scale)}
                          fill={isActive || isHovered ? "#0a66d6" : "#ffffff"}
                          stroke="#0a66d6"
                          strokeWidth={0.9 / Math.max(0.0001, scale)}
                          onMouseEnter={(ev) => {
                            const rect = svgRef.current?.getBoundingClientRect();
                            if (!rect) return;
                            setHoveredPoint({ x, y, clientX: (ev as any).clientX, clientY: (ev as any).clientY });
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      ))}
                      {closed && (
                        (() => {
                          const xs = c.map((p) => p[0]);
                          const ys = c.map((p) => p[1]);
                          const lx = Math.min(...xs);
                          const ly = Math.min(...ys);
                          let area = 0;
                          try {
                            area = shoelaceArea(contours[ci]);
                          } catch {}
                          return (
                            <text x={lx + 6} y={ly - 6} fontSize={12 / Math.max(0.0001, scale)} fill="#123" style={{ pointerEvents: "none" }}>
                              {area ? `${(area / 10000).toFixed(4)} га` : ""}
                            </text>
                          );
                        })()
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {hoveredPoint && (
              <div
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  left: hoveredPoint.clientX + 12,
                  top: hoveredPoint.clientY + 12,
                  background: "rgba(12,34,80,0.95)",
                  color: "white",
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  zIndex: 50,
                }}
              >
                <div>
                  <strong>{hoveredPoint.x.toFixed(3)}</strong>, <span>{hoveredPoint.y.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls / List */}
        <aside className="w-96">
          <div className="bg-white/60 dark:bg-gray-900/60 p-3 rounded-xl border mb-4">
            <p className="text-sm text-gray-600">Вставьте координаты или импортируйте .txt файл (точки по строкам, пустая строка = новый контур)</p>

            <div className="mt-3">
              <label className="text-xs text-gray-700">Исходные координаты</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="w-full mt-2 p-2 border rounded bg-white text-sm"
                placeholder="Например: 408840,82 3304151,05"
              />
              {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

              <div className="mt-3 flex items-center gap-2">
                <button onClick={processTextNow} className="px-3 py-2 rounded bg-electric-600 text-white">
                  Обработать
                </button>
                <button onClick={() => { setText(""); setContours([]); }} className="px-3 py-2 rounded border">
                  Очистить
                </button>

                <label className="inline-flex items-center px-3 py-2 rounded border cursor-pointer">
                  Импорт .txt
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleTxtFile(f);
                      (e.target as HTMLInputElement).value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white/60 dark:bg-gray-900/60 p-3 rounded-xl border mb-4">
            <h4 className="font-medium mb-2">Контуры</h4>
            <div className="max-h-64 overflow-auto space-y-2">
              {contours.length === 0 ? (
                <div className="text-sm text-gray-500">Нет контуров</div>
              ) : (
                contours.map((c, idx) => {
                  let tip = "контур";
                  try {
                    if (isClosed(c)) {
                      const a = shoelaceArea(c);
                      tip = `Площадь: ${a.toFixed(2)} м² (${(a / 10000).toFixed(4)} га)`;
                    } else tip = "контур не замкнут";
                  } catch {}
                  const highlighted = idx === activeContourIdx || idx === hoveredContourIdx;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredContourIdx(idx)}
                      onMouseLeave={() => setHoveredContourIdx((s) => (s === idx ? null : s))}
                      onClick={() => focusContour(idx)}
                      className={`p-2 rounded cursor-pointer flex items-start gap-2 ${highlighted ? "ring-2 ring-electric-300 bg-white" : "hover:bg-white/50"}`}
                    >
                      <input type="checkbox" checked={!!selectedIndices[idx]} onChange={(e) => { e.stopPropagation(); toggleSelected(idx); }} />
                      <div className="flex-1 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">#{idx + 1}</div>
                          {isClosed(c) ? <div className="text-xs text-gray-600">{(shoelaceArea(c)/10000).toFixed(4)} га</div> : <div className="text-xs text-red-600">open</div>}
                        </div>
                        <div className="text-xs text-gray-500">{tip}</div>
                        <div className="mt-2 text-xs text-gray-500 line-clamp-3">
                          {c.slice(0, 6).map((p) => p.join(", ")).join("  /  ")}{c.length > 6 ? " …" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white/60 dark:bg-gray-900/60 p-3 rounded-xl border">
            <h4 className="font-medium mb-2">Расчёт</h4>
            <div className="text-sm mb-2">
              <div className="flex justify-between"><span>Замкнутых контуров</span><strong>{totals.closed}</strong></div>
              <div className="flex justify-between"><span>Включено в расчёт</span><strong>{totals.included}</strong></div>
              <div className="flex justify-between"><span>Площадь (га)</span><strong>{totals.totalHa.toFixed(4)}</strong></div>
            </div>

            <div className="flex items-center gap-2">
              <input placeholder="Цена за 1 га" value={pricePerHa} onChange={(e) => setPricePerHa(e.target.value)} className="p-2 rounded border w-full text-sm" />
              <button onClick={() => { try { const v = parseFloat(pricePerHa.toString().replace(",", ".")); if (isNaN(v)) throw new Error("некорректная цена"); alert(`Итого: ${(v * totals.totalHa).toFixed(2)} руб.`); } catch(e:any){ alert(e.message || String(e)); }}} className="px-3 py-2 rounded bg-electric-600 text-white">
                Рассчитать
              </button>
            </div>

            <div className="mt-4">
              <button onClick={openLetterModal} className="w-full px-3 py-2 rounded bg-blue-600 text-white flex items-center justify-center gap-2">
                <Icons.Mail size={16} />
                Сформировать письмо
              </button>
            </div>
            <div className="mt-4">
              <button onClick={openContractModal} className="w-full px-3 py-2 rounded bg-green-600 text-white flex items-center justify-center gap-2">
                <Icons.Handshake size={16} />
                Сформировать договор
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Letter modal */}
      {isLetterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsLetterOpen(false)}
            onWheel={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />

          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl p-4">
            <form onSubmit={submitLetterForm} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Сформировать письмо</h3>
                <button type="button" onClick={() => setIsLetterOpen(false)} className="text-sm px-2 py-1 rounded hover:bg-gray-100">Закрыть</button>
              </div>

              <p className="text-sm text-gray-500 mb-4">Заполните поля — рядом указаны примеры ввода.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Должность руководителя в Р.П.</span>
                    <input value={letterForm.manager_position ?? ""} onChange={(e) => handleLetterInput("manager_position", e.target.value)} placeholder="Генеральному директору" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: Генеральному директору</span>
                  </label>
                </div>

                <div>
                  <span className="text-xs text-gray-600">Пол руководителя</span>
                  <div className="mt-1 flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="radio" name="manager_gender" checked={letterForm.manager_gender === "male"} onChange={() => handleLetterInput("manager_gender", "male")} />
                      <span>Мужской</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="radio" name="manager_gender" checked={letterForm.manager_gender === "female"} onChange={() => handleLetterInput("manager_gender", "female")} />
                      <span>Женский</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Короткое наименование юр. лица</span>
                    <input value={letterForm.company_short_name ?? ""} onChange={(e) => handleLetterInput("company_short_name", e.target.value)} placeholder='ООО "Рога и Копыта"' className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: ООО «Рога и Копыта»</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Фамилия и инициалы руководителя</span>
                    <input value={letterForm.surname_initials ?? ""} onChange={(e) => handleLetterInput("surname_initials", e.target.value)} placeholder="Иванов И.И." className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: Иванов И.И.</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Юридический адрес</span>
                    <input value={letterForm.legal_address ?? ""} onChange={(e) => handleLetterInput("legal_address", e.target.value)} placeholder="664009, Иркутская область, г.Иркутск, ул. Пушкина, д. Колотушкина" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: 664009, Иркутская область, г.Иркутск, ул. Пушкина, д. Колотушкина</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Email получателя</span>
                    <input type="email" value={letterForm.email ?? ""} onChange={(e) => handleLetterInput("email", e.target.value)} placeholder="secretar@company.ru" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: secretar@company.ru</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Имя и отчество получателя</span>
                    <input value={letterForm.first_name_and_patronymic ?? ""} onChange={(e) => handleLetterInput("first_name_and_patronymic", e.target.value)} placeholder="Иван Иванович" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: Иван Иванович</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Номер обращения и дата</span>
                    <input value={letterForm.case_number ?? ""} onChange={(e) => handleLetterInput("case_number", e.target.value)} placeholder="01/01-01 от 01.01.2025 г." className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: 01/01-01 от 01.01.2025 г.</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Цена за гектар</span>
                    <input value={letterForm.price_per_hectare ?? ""} onChange={(e) => handleLetterInput("price_per_hectare", e.target.value)} placeholder="3136" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: 3136 (в руб.)</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Должность исполнителя</span>
                    <input value={letterForm.executor_position ?? ""} onChange={(e) => handleLetterInput("executor_position", e.target.value)} placeholder="Ведущий Инженер" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: Ведущий Инженер</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">ФИО исполнителя</span>
                    <input value={letterForm.executor_fio ?? ""} onChange={(e) => handleLetterInput("executor_fio", e.target.value)} placeholder="Петров П.П." className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: Петров П.П.</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Телефон исполнителя</span>
                    <input type="tel" value={letterForm.executor_number ?? ""} onChange={(e) => handleLetterInput("executor_number", e.target.value)} placeholder="99-99-99, +7-999-123-45-67" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: 99-99-99, +7-999-123-45-67</span>
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Email исполнителя</span>
                    <input type="email" value={letterForm.executor_email ?? ""} onChange={(e) => handleLetterInput("executor_email", e.target.value)} placeholder="executor@company.ru" className="mt-1 p-2 border rounded bg-white text-sm" />
                    <span className="mt-1 text-xs italic text-gray-400">Пример: executor@company.ru</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsLetterOpen(false)} className="px-3 py-2 rounded border">Отмена</button>
                <button type="submit" className="px-4 py-2 rounded bg-electric-600 text-white">Скачать DOCX</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract modal */}
      {isContractOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsContractOpen(false)}
            onWheel={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
          <div className="relative z-50 w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl p-4">
            <form onSubmit={submitContractForm as any} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Сформировать договор</h3>
                <button type="button" onClick={() => setIsContractOpen(false)} className="text-sm px-2 py-1 rounded hover:bg-gray-100">Закрыть</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Полное наименование юр. лица</span>
                    <input value={contractForm.company_full_name ?? ""} onChange={(e) => handleContractInput("company_full_name", e.target.value)} placeholder="Общество с ограниченной ответственностью..." className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Должность руководителя</span>
                    <input value={contractForm.manager_position ?? ""} onChange={(e) => handleContractInput("manager_position", e.target.value)} placeholder="Генеральный директор" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">ФИО руководителя</span>
                    <input value={contractForm.manager_fio ?? ""} onChange={(e) => handleContractInput("manager_fio", e.target.value)} placeholder="Иванов Иван Иванович" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Адрес объекта</span>
                    <input value={contractForm.object_address ?? ""} onChange={(e) => handleContractInput("object_address", e.target.value)} placeholder="г. ..., ул. ..." className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Сумма договора (включая НДС)</span>
                    <input value={contractForm.contract_price ?? ""} onChange={(e) => handleContractInput("contract_price", e.target.value)} placeholder="23614,08" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Короткое наименование</span>
                    <input value={contractForm.company_short_name ?? ""} onChange={(e) => handleContractInput("company_short_name", e.target.value)} placeholder='ООО "Рога и Копыта"' className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Юридический адрес</span>
                    <input value={contractForm.legal_address ?? ""} onChange={(e) => handleContractInput("legal_address", e.target.value)} placeholder="Юридический адрес" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Телефон заказчика</span>
                    <input value={contractForm.customer_contact_number ?? ""} onChange={(e) => handleContractInput("customer_contact_number", e.target.value)} placeholder="+7-..." className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Email заказчика</span>
                    <input value={contractForm.email ?? ""} onChange={(e) => handleContractInput("email", e.target.value)} placeholder="contact@company.ru" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">ИНН/КПП</span>
                    <input value={contractForm["INN/KPP"] ?? ""} onChange={(e) => handleContractInput("INN/KPP", e.target.value)} placeholder="1234567890/123456789" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">ОГРН</span>
                    <input value={contractForm.OGRN ?? ""} onChange={(e) => handleContractInput("OGRN", e.target.value)} placeholder="..." className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Банковские реквизиты (банк, р/с, кор/с, БИК)</span>
                    <input value={contractForm.bank_name ?? ""} onChange={(e) => handleContractInput("bank_name", e.target.value)} placeholder="Банк ..." className="mt-1 p-2 border rounded bg-white text-sm mb-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={contractForm.current_account ?? ""} onChange={(e) => handleContractInput("current_account", e.target.value)} placeholder="Р/с" className="p-2 border rounded bg-white text-sm" />
                      <input value={contractForm.correspondent_account ?? ""} onChange={(e) => handleContractInput("correspondent_account", e.target.value)} placeholder="Кор/с" className="p-2 border rounded bg-white text-sm" />
                      <input value={contractForm.BIC ?? ""} onChange={(e) => handleContractInput("BIC", e.target.value)} placeholder="БИК" className="p-2 border rounded bg-white text-sm" />
                    </div>
                  </label>
                </div>

                {/* mandatory area and price per ha */}
                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Площадь (га)</span>
                    <input required value={contractForm.area_hectares ?? ""} onChange={(e) => handleContractInput("area_hectares", e.target.value)} placeholder="1.2345" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>

                <div>
                  <label className="flex flex-col text-sm">
                    <span className="text-xs text-gray-600">Цена за 1 га (включая НДС)</span>
                    <input required value={contractForm.price_hectare ?? ""} onChange={(e) => handleContractInput("price_hectare", e.target.value)} placeholder="3136" className="mt-1 p-2 border rounded bg-white text-sm" />
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsContractOpen(false)} className="px-3 py-2 rounded border">Отмена</button>
                <button type="submit" className="px-4 py-2 rounded bg-electric-600 text-white">Скачать договор (DOCX)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
