import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const src = path.join(root, "env.json");
const dest = path.join(root, "dist", "env.json");

if (!fs.existsSync(src)) {
  console.warn("copy-env: env.json not found at", src, ", skipping");
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
