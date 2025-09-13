export type Point = [number, number];

export type PolyObj = {
  cadastral: string;
  address?: string;
  centerOrigX: number | null;
  centerOrigY: number | null;
  origPoints: Point[];
  plotPoints: Point[];
  p_active?: string;
  p_reactive?: string;
  p_full?: string;
  pf?: string;
};
