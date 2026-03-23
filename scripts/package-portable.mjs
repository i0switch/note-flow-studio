import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const platformArg = process.argv.find((a) => a.startsWith("--platform="))?.split("=")[1]
  ?? (process.argv.includes("--platform") ? process.argv[process.argv.indexOf("--platform") + 1] : null)
  ?? (process.platform === "darwin" ? "mac-arm64" : "win");

const VALID_PLATFORMS = ["win", "mac-arm64", "mac-x64"];
if (!VALID_PLATFORMS.includes(platformArg)) {
  throw new Error(`Unknown platform: ${platformArg}. Use --platform win, mac-arm64, or mac-x64`);
}

const isMac = platformArg === "mac-arm64" || platformArg === "mac-x64";

const rootDir = process.cwd();
const releaseDir = path.resolve(rootDir, "release", `note-local-draft-studio-portable-${platformArg}`);
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

const stripWorkspacesFromPackageJson = async () => {
  const pkgPath = path.join(releaseDir, "package.json");
  const raw = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  delete raw.workspaces;
  await fs.writeFile(pkgPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
};

const bundleNodeRuntime = async () => {
  if (!isMac) {
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
  } else {
    const arch = platformArg === "mac-arm64" ? "arm64" : "x64";
    const tarName = `node-v${nodeVersion}-darwin-${arch}.tar.gz`;
    const extractedDir = path.join(releaseDir, `node-v${nodeVersion}-darwin-${arch}`);
    const tarPath = path.join(releaseDir, tarName);
    const response = await fetch(`https://nodejs.org/dist/v${nodeVersion}/${tarName}`);
    if (!response.ok) throw new Error(`NODE_RUNTIME_DOWNLOAD_FAILED_${response.status}`);
    await fs.writeFile(tarPath, Buffer.from(await response.arrayBuffer()));
    await run("tar", ["xzf", tarName], { cwd: releaseDir });
    await fs.rename(extractedDir, runtimeDir);
    await fs.rm(tarPath, { force: true });
  }
};

const writeLaunchers = async () => {
  if (!isMac) {
    const startBat = `@echo off\r\nsetlocal\r\ncd /d %~dp0\r\nset ENV_FILE_PATH=%~dp0.env\r\nset APP_DATA_DIR=%~dp0data\r\nset PLAYWRIGHT_BROWSERS_PATH=%~dp0ms-playwright\r\nset SERVE_WEB_FROM_SERVER=true\r\nset WEB_DIST_DIR=%~dp0saas-hub\\dist\r\nset OPEN_BROWSER_ON_START=true\r\nif exist "%~dp0runtime\\node.exe" (\r\n  "%~dp0runtime\\node.exe" "%~dp0apps\\server\\dist\\apps\\server\\src\\server.js"\r\n) else (\r\n  node "%~dp0apps\\server\\dist\\apps\\server\\src\\server.js"\r\n)\r\nendlocal\r\n`;
    const startHeadlessBat = startBat.replace("set OPEN_BROWSER_ON_START=true", "set OPEN_BROWSER_ON_START=false");
    const firstReadme = `# Portable localhost app\n\n1. \`start-note-local.bat\` を実行\n2. 初回セットアップ画面で APIキーと note情報を保存\n3. Chromium 未導入なら画面内のボタンで導入\n4. 以後はこのフォルダのまま利用\n`;
    await fs.writeFile(path.join(releaseDir, "start-note-local.bat"), startBat, "utf8");
    await fs.writeFile(path.join(releaseDir, "start-note-local-headless.bat"), startHeadlessBat, "utf8");
    await fs.writeFile(path.join(releaseDir, "README_FIRST.txt"), firstReadme, "utf8");
  } else {
    const startSh = `#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexport ENV_FILE_PATH="$DIR/.env"\nexport APP_DATA_DIR="$DIR/data"\nexport PLAYWRIGHT_BROWSERS_PATH="$DIR/ms-playwright"\nexport SERVE_WEB_FROM_SERVER=true\nexport WEB_DIST_DIR="$DIR/saas-hub/dist"\nexport OPEN_BROWSER_ON_START=true\nif [ -f "$DIR/runtime/bin/node" ]; then\n  "$DIR/runtime/bin/node" "$DIR/apps/server/dist/apps/server/src/server.js"\nelse\n  node "$DIR/apps/server/dist/apps/server/src/server.js"\nfi\n`;
    const startHeadlessSh = startSh.replace("export OPEN_BROWSER_ON_START=true", "export OPEN_BROWSER_ON_START=false");
    const setupSh = `#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\necho "=== note-local セットアップ ==="\necho "Chromium をインストール中..."\nexport PLAYWRIGHT_BROWSERS_PATH="$DIR/ms-playwright"\nif [ -f "$DIR/runtime/bin/node" ]; then\n  "$DIR/runtime/bin/node" "$DIR/node_modules/playwright/cli.js" install chromium\nelse\n  node "$DIR/node_modules/playwright/cli.js" install chromium\nfi\necho ""\necho "セットアップ完了！start-note-local.sh でアプリを起動できます。"\n`;
    const firstReadme = [
      "# note-local-draft-studio（Mac版）",
      "",
      "## 初回セットアップ（最初の1回だけ）",
      "",
      "1. このフォルダを好きな場所に置く",
      "2. `setup.sh` をダブルクリック、または Terminal で実行:",
      "   ```",
      "   cd このフォルダのパス",
      "   ./setup.sh",
      "   ```",
      "   → Chromium（ブラウザ自動操作エンジン）がインストールされる",
      "",
      "## 起動方法",
      "",
      "- `start-note-local.sh` をダブルクリック（Terminal が開いてサーバーが起動）",
      "- または Terminal で: `./start-note-local.sh`",
      "",
      "初回起動時はセットアップ画面が表示されるので、APIキーとnoteアカウント情報を入力してね。",
      "",
      "## ヘッドレス起動（ブラウザを自動で開かない）",
      "",
      "- `start-note-local-headless.sh` を実行",
      "- その後 http://127.0.0.1:3001 にアクセス",
      "",
      "## 注意事項",
      "",
      platformArg === "mac-arm64"
        ? "- Apple Silicon (M1/M2/M3) Mac 専用のバイナリを同梱"
        : "- Intel Mac 専用のバイナリを同梱",
      platformArg === "mac-arm64"
        ? "- Intel Mac の場合は mac-x64 版を使ってね"
        : "- Apple Silicon Mac の場合は mac-arm64 版を使ってね",
    ].join("\n") + "\n";
    const shPath = path.join(releaseDir, "start-note-local.sh");
    const shHeadlessPath = path.join(releaseDir, "start-note-local-headless.sh");
    const setupShPath = path.join(releaseDir, "setup.sh");
    await fs.writeFile(shPath, startSh, "utf8");
    await fs.writeFile(shHeadlessPath, startHeadlessSh, "utf8");
    await fs.writeFile(setupShPath, setupSh, "utf8");
    await fs.writeFile(path.join(releaseDir, "README_FIRST.txt"), firstReadme, "utf8");
    await fs.chmod(shPath, 0o755);
    await fs.chmod(shHeadlessPath, 0o755);
    await fs.chmod(setupShPath, 0o755);
  }
};

const installRuntimeDependencies = async () => {
  const command = process.platform === "win32" ? "cmd" : "npm";
  const args =
    process.platform === "win32"
      ? ["/c", "npm", "install", "--omit=dev", "--workspace", "@note-local/server", "--workspace", "@note-local/shared"]
      : ["install", "--omit=dev", "--workspace", "@note-local/server", "--workspace", "@note-local/shared"];
  await run(command, args, { cwd: releaseDir });
};

const resolveWorkspaceSymlinks = async () => {
  const scopeDir = path.join(releaseDir, "node_modules", "@note-local");
  for (const pkg of ["shared", "server"]) {
    const linkPath = path.join(scopeDir, pkg);
    let stat;
    try {
      stat = await fs.lstat(linkPath);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) {
      const target = await fs.readlink(linkPath);
      const realPath = path.resolve(path.dirname(linkPath), target);
      await fs.rm(linkPath);
      await fs.cp(realPath, linkPath, { recursive: true });
    }
  }
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
  await resolveWorkspaceSymlinks();
  await stripWorkspacesFromPackageJson();
  if (!isMac) await installPlaywrightBrowser();
  await bundleNodeRuntime();
  await writeLaunchers();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
