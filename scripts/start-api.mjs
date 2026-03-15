import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ensurePortsAvailable } from "./port-guard.mjs";

const rootDir = process.cwd();
const appPort = Number(process.env.APP_PORT ?? "3001");
const serverEntry = path.join(
  rootDir,
  "apps",
  "server",
  "dist",
  "apps",
  "server",
  "src",
  "server.js"
);

if (!fs.existsSync(serverEntry)) {
  console.error("apps/server のビルド成果物が見つからない。先に `npm run build` を流して。");
  process.exit(1);
}

await ensurePortsAvailable([appPort], { logger: console.log });

const child = spawn(process.execPath, [serverEntry], {
  cwd: rootDir,
  env: {
    ...process.env,
    APP_PORT: String(appPort),
    OPEN_BROWSER_ON_START: process.env.OPEN_BROWSER_ON_START ?? "false"
  },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(0);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
