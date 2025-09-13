// vk-shell/src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import Shell from "./Shell";

import { registerApp } from "./utils/registry";
import { meta as powerMeta } from "./apps/examplePowerCalc/meta";
import { meta as centertpMeta } from "./apps/centertp/meta";

// register using dynamic loader (code-splitting)
registerApp(powerMeta.id, () => import("./apps/examplePowerCalc"), powerMeta);
registerApp(centertpMeta.id, () => import("./apps/centertp"), centertpMeta);

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>
);
