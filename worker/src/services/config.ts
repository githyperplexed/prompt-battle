import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { panelSchema } from "$src/utilities/contest-config";

// Read the repo-root config.json relative to this file (cwd-independent).
const path = fileURLToPath(new URL("../../../config.json", import.meta.url));
const parsed = JSON.parse(readFileSync(path, "utf8")) as { panel?: unknown };

export const defaultPanel = panelSchema.parse(parsed.panel);
