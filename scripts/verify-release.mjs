import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { ensurePortsAvailable } from "./port-guard.mjs";

const rootDir = process.cwd();
const releaseDir = path.resolve(rootDir, "release", "note-local-draft-studio-portable");
const port = Number(process.env.RELEASE_VERIFY_PORT ?? "3310");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, init) => {
  const response = await fetch(url, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // noop
    }
    await wait(1000);
  }
  throw new Error("RELEASE_VERIFY_HEALTH_TIMEOUT");
};

const main = async () => {
  await ensurePortsAvailable([port], { logger: console.log });

  const envFilePath = path.join(releaseDir, ".env");
  await fs.rm(envFilePath, { force: true });
  await fs.rm(path.join(releaseDir, "data"), { recursive: true, force: true });
  await fs.mkdir(path.join(releaseDir, "data"), { recursive: true });

  const server = spawn(
    path.join(releaseDir, "runtime", "node.exe"),
    [path.join(releaseDir, "apps", "server", "dist", "apps", "server", "src", "server.js")],
    {
      cwd: releaseDir,
      env: {
        ...process.env,
        ENV_FILE_PATH: ".env",
        APP_DATA_DIR: "./data",
        PLAYWRIGHT_BROWSERS_PATH: "./ms-playwright",
        SERVE_WEB_FROM_SERVER: "true",
        WEB_DIST_DIR: "./apps/web/dist",
        OPEN_BROWSER_ON_START: "false",
        APP_PORT: String(port)
      },
      stdio: "pipe"
    }
  );

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHealth();
    const setupBefore = await fetchJson(`http://127.0.0.1:${port}/api/setup/status`);
    const deps = await fetchJson(`http://127.0.0.1:${port}/api/setup/dependencies`);
    const saveResult = await fetchJson(`http://127.0.0.1:${port}/api/setup/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        geminiApiKey: "test-key",
        geminiModel: "gemini-2.0-flash",
        noteLoginId: "demo-note",
        noteLoginPassword: "demo-password",
        pinchtabBaseUrl: "http://localhost:9867",
        pinchtabProfileName: "note-live",
        pinchtabLaunchPort: 9870,
        playwrightHeadless: false,
        localhostPort: port
      })
    });
    const setupAfter = await fetchJson(`http://127.0.0.1:${port}/api/setup/status`);

    console.log(JSON.stringify({ setupBefore, deps, saveResult, setupAfter }, null, 2));
  } finally {
    server.kill();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
