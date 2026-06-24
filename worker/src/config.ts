import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type PanelModel = { id: string; slug: string };

// Read the repo-root config.json relative to this file (cwd-independent).
const path = fileURLToPath(new URL("../../config.json", import.meta.url));
const parsed = JSON.parse(readFileSync(path, "utf8")) as { panel: PanelModel[] };

export const panel = parsed.panel;
