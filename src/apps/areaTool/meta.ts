export const meta = {
  id: "areaTool",
  title: "ТопоПлан",
  icon: "Map",
  size: "medium",
  description: "Загрузка/парсинг контуров, отображение, расчёт площади и экспорт CSV.",
  departmentId: "res",
  departmentTitle: "РЭС",
} as const;

export type AreaToolMeta = typeof meta;
