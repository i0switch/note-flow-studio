import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const releaseDir = path.resolve(rootDir, "release", "note-local-draft-studio-portable");
const runtimeDir = path.join(releaseDir, "runtime");
const nodeVersion = process.version.replace(/^v/, "");

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "pipe",
      shell: false,
      ...options
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output || `${command} failed with ${code}`));
    });
  });

const copy = async (from, to) => {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.cp(from, to, { recursive: true, force: true });
};

const writeRuntimePackage = async () => {
  const packageJson = {
    name: "note-local-draft-studio-portable",
    private: true,
    workspaces: ["apps/server", "packages/shared"]
  };
  await fs.writeFile(path.join(releaseDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
};

const bundleNodeRuntime = async () => {
  const zipName = `node-v${nodeVersion}-win-x64.zip`;
  const extractedDir = path.join(releaseDir, `node-v${nodeVersion}-win-x64`);
  const zipPath = path.join(releaseDir, zipName);
  const response = await fetch(`https://nodejs.org/dist/v${nodeVersion}/${zipName}`);
  if (!response.ok) throw new Error(`NODE_RUNTIME_DOWNLOAD_FAILED_${response.status}`);
  await fs.writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  await run("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${releaseDir.replace(/'/g, "''")}' -Force`
  ]);
  await fs.rename(extractedDir, runtimeDir);
  await fs.rm(zipPath, { force: true });
};

const writeLaunchers = async () => {
  const startBat = `@echo off
setlocal
cd /d %~dp0
set ENV_FILE_PATH=.env
set APP_DATA_DIR=./data
set PLAYWRIGHT_BROWSERS_PATH=./ms-playwright
set SERVE_WEB_FROM_SERVER=true
set WEB_DIST_DIR=./saas-hub/dist
set OPEN_BROWSER_ON_START=true
if exist ".\\runtime\\node.exe" (
  ".\\runtime\\node.exe" ".\\apps\\server\\dist\\apps\\server\\src\\server.js"
) else (
  node ".\\apps\\server\\dist\\apps\\server\\src\\server.js"
)
endlocal
`;
  const startHeadlessBat = startBat.replace("set OPEN_BROWSER_ON_START=true", "set OPEN_BROWSER_ON_START=false");
  const firstReadme = `# Portable localhost app\n\n1. \`start-note-local.bat\` を実行\n2. 初回セットアップ画面で APIキーと note情報を保存\n3. Chromium 未導入なら画面内のボタンで導入\n4. 以後はこのフォルダのまま利用\n`;
  await fs.writeFile(path.join(releaseDir, "start-note-local.bat"), startBat, "utf8");
  await fs.writeFile(path.join(releaseDir, "start-note-local-headless.bat"), startHeadlessBat, "utf8");
  await fs.writeFile(path.join(releaseDir, "README_FIRST.txt"), firstReadme, "utf8");
};

const installRuntimeDependencies = async () => {
  const command = process.platform === "win32" ? "cmd" : "npm";
  const args =
    process.platform === "win32"
      ? ["/c", "npm", "install", "--omit=dev", "--workspace", "@note-local/server", "--workspace", "@note-local/shared"]
      : ["install", "--omit=dev", "--workspace", "@note-local/server", "--workspace", "@note-local/shared"];
  await run(command, args, { cwd: releaseDir });
};

const installPlaywrightBrowser = async () => {
  await run(process.execPath, [path.join(releaseDir, "node_modules", "playwright", "cli.js"), "install", "chromium"], {
    cwd: releaseDir,
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.join(releaseDir, "ms-playwright")
    }
  });
};

const main = async () => {
  await fs.rm(releaseDir, { recursive: true, force: true });
  await fs.mkdir(releaseDir, { recursive: true });
  await writeRuntimePackage();
  await copy(path.join(rootDir, "apps", "server", "package.json"), path.join(releaseDir, "apps", "server", "package.json"));
  await copy(path.join(rootDir, "packages", "shared", "package.json"), path.join(releaseDir, "packages", "shared", "package.json"));
  await copy(path.join(rootDir, "apps", "server", "dist"), path.join(releaseDir, "apps", "server", "dist"));
  await copy(path.join(rootDir, "packages", "shared", "dist"), path.join(releaseDir, "packages", "shared", "dist"));
  await copy(path.join(rootDir, "saas-hub", "dist"), path.join(releaseDir, "saas-hub", "dist"));
  await copy(path.join(rootDir, ".env.example"), path.join(releaseDir, ".env.example"));
  await copy(path.join(rootDir, "TEST_RESULTS.md"), path.join(releaseDir, "TEST_RESULTS.md"));
  await fs.mkdir(path.join(releaseDir, "data"), { recursive: true });
  await installRuntimeDependencies();
  await installPlaywrightBrowser();
  await bundleNodeRuntime();
  await writeLaunchers();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
