import { spawn } from "node:child_process";
import { execSync } from "node:child_process";

const cwd = process.cwd();
const apiPort = process.env.SAAS_HUB_API_PORT ?? "4301";
const webPort = process.env.SAAS_HUB_WEB_PORT ?? "4273";
const baseEnv = {
  ...process.env,
  SAAS_HUB_API_PORT: apiPort,
  SAAS_HUB_WEB_PORT: webPort,
  SAAS_HUB_API_TARGET: `http://127.0.0.1:${apiPort}`,
  SMOKE_BASE_URL: process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${webPort}`,
  RUN_REAL_NOTE:
    process.env.RUN_REAL_NOTE ??
    (process.env.NOTE_LOGIN_ID && process.env.NOTE_LOGIN_PASSWORD ? "1" : "0"),
};

const toCommandString = (command, args = []) =>
  process.platform === "win32"
    ? `${command} ${args.join(" ")}`
    : [command, ...args].join(" ");

const runCommand = (command, args, env = baseEnv) =>
  new Promise((resolve, reject) => {
    const child = spawn(toCommandString(command, args), {
      cwd,
      env,
      shell: true,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed: ${code}`));
    });
  });

const startServer = (command, args) =>
  spawn(toCommandString(command, args), {
    cwd,
    env: baseEnv,
    shell: true,
    stdio: "ignore",
  });

const freeWindowsPorts = (ports) => {
  const portList = ports.join(",");
  const script = `
$ports = @(${portList})
foreach ($p in $ports) {
  $procIds = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $procIds) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}
`;

  try {
    execSync(`powershell -NoProfile -Command "${script.replace(/\r?\n/g, " ")}"`, {
      cwd,
      stdio: "ignore",
    });
  } catch {
    // noop
  }
};

const stopServer = (child) =>
  new Promise((resolve) => {
    if (!child || child.killed) {
      resolve();
      return;
    }
    child.once("close", () => resolve());
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      } catch {
        child.kill();
      }
    } else {
      child.kill("SIGTERM");
    }
    setTimeout(() => resolve(), 5_000);
  });

const waitFor = async (url, attempts = 60) => {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // noop
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const main = async () => {
  await runCommand("npm", ["run", "lint"]);
  await runCommand("npm", ["test", "--", "--run"]);
  await runCommand("npm", ["run", "build"]);

  freeWindowsPorts([Number(apiPort), Number(webPort)]);

  const api = startServer("npm", ["run", "start:api"]);
  const preview = startServer("npm", ["run", "preview", "--", "--strictPort", "--host", "127.0.0.1", "--port", webPort]);

  try {
    await waitFor(`http://127.0.0.1:${apiPort}/api/health`);
    await waitFor(`http://127.0.0.1:${webPort}`);
    await runCommand("node", ["scripts/release-smoke.mjs"]);
  } finally {
    await Promise.all([stopServer(api), stopServer(preview)]);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
