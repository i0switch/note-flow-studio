import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ensurePortsAvailable } from "./port-guard.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rootDir = process.cwd();
const host = "127.0.0.1";
const appPort = Number(process.env.APP_PORT ?? "3001");
const webPort = Number(process.env.WEB_PORT ?? "4273");
const exitAfterReady = process.env.RELEASE_CHECK_EXIT_AFTER_READY === "1";
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
const viteEntry = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const webDistDir = path.join(rootDir, "apps", "web", "dist", "index.html");
const children = [];

const ensureBuildArtifacts = () => {
  if (
    !fs.existsSync(serverEntry) ||
    !fs.existsSync(webDistDir) ||
    !fs.existsSync(viteEntry)
  ) {
    throw new Error("release-check 用のビルド成果物が足りない。先に `npm run build` を流して。");
  }
};

const attachLogging = (name, child) => {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
};

const waitForUrl = async (url, label) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // noop
    }
    await wait(500);
  }

  throw new Error(`${label} の起動確認に失敗した: ${url}`);
};

const spawnServer = () => {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      APP_PORT: String(appPort),
      OPEN_BROWSER_ON_START: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  attachLogging("api", child);
  children.push(child);
  return child;
};

const spawnPreview = () => {
  const child = spawn(
    process.execPath,
    [
      viteEntry,
      "preview",
      "--host",
      host,
      "--port",
      String(webPort),
      "--strictPort"
    ],
    {
      cwd: path.join(rootDir, "apps", "web"),
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://${host}:${appPort}/api`
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  attachLogging("preview", child);
  children.push(child);
  return child;
};

const cleanup = async () => {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  await wait(500);
};

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await cleanup();
    process.exit(0);
  });
}

try {
  ensureBuildArtifacts();
  await ensurePortsAvailable([appPort, webPort], { logger: console.log });

  const server = spawnServer();
  server.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[start:release-check] API サーバーが終了した: exit ${code}`);
    }
  });
  await waitForUrl(`http://${host}:${appPort}/api/health`, "API");

  const preview = spawnPreview();
  preview.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[start:release-check] preview が終了した: exit ${code}`);
    }
  });
  await waitForUrl(`http://${host}:${webPort}`, "preview");

  console.log(
    [
      "[start:release-check] 起動完了",
      `- API: http://${host}:${appPort}/api/health`,
      `- Web: http://${host}:${webPort}`,
      "- 既存の vite preview / tsx server / built server が同じポートを握っていた場合は事前に停止した"
    ].join("\n")
  );

  if (exitAfterReady) {
    await cleanup();
    process.exit(0);
  }

  await Promise.race(
    children.map(
      (child) =>
        new Promise((resolve) => {
          child.on("exit", resolve);
        })
    )
  );

  process.exit(1);
} catch (error) {
  console.error(
    error instanceof Error ? `[start:release-check] ${error.message}` : String(error)
  );
  await cleanup();
  process.exit(1);
}
