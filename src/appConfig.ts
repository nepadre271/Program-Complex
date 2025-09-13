/* vk-shell/src/appConfig.ts */

export const APP_SIZES = {
  small: { width: 420, height: 420 },
  medium: { width: 900, height: 600 },
  large: { width: 1280, height: 820 }
} as const;

export const DEFAULT_APP_SIZE = "medium" as const;

export const ELECTRIC_BLUE = {
  primary: "#198cff",
  primaryDark: "#1066cc",
  accentStart: "#3aa0ff",
  accentEnd: "#0066ff"
} as const;
