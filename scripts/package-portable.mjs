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
    const firstReadme = [
      "# note記事自動生成アプリ（Windows版）",
      "",
      "キーワードを入れるだけで note 用の記事を生成し、そのまま下書き保存・公開まで",
      "できるローカルアプリです。インストール不要。このフォルダを解凍するだけで動きます。",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 事前に用意するもの",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "□ note アカウント（投稿先）",
      "□ AI の API キー（記事生成に使います）",
      "   ※ Gemini（無料枠あり）がおすすめ",
      "   　 取得先: https://aistudio.google.com/app/apikey",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 起動方法",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "1. 「start-note-local.bat」をダブルクリック",
      "2. 黒いウィンドウ（コマンドプロンプト）が開きます → そのまま閉じないでください",
      "3. しばらくするとブラウザが自動で開きます（http://127.0.0.1:3001）",
      "   → 開かない場合はブラウザで上記 URL を手動で開いてください",
      "",
      "▶ 終了するときは黒いウィンドウを閉じてください",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 初回セットアップ（最初の1回だけ）",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "ブラウザが開いたら「設定」画面から以下を入力して保存してください。",
      "",
      "【AIプロバイダの設定】",
      "  → 「Gemini」を選択し、API キーを入力 → 「保存」",
      "",
      "【note アカウントの設定】",
      "  → note のログイン ID（メールアドレス）とパスワードを入力 → 「保存」",
      "",
      "【Chromium のインストール（ブラウザ自動操作エンジン）】",
      "  → 「診断」画面 → 「Chromium をインストール」ボタンをクリック",
      "  → 完了するまで数分かかります",
      "",
      "設定が終わったら「診断」画面で「再診断」を押して、",
      "すべて ✅ になっていれば準備完了です。",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 使い方（基本）",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "1. トップ画面（生成）でキーワードを入力",
      "2. 「生成後下書き」または「生成後即公開」をクリック",
      "3. 記事が生成されたら内容を確認して完了",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ よくあるトラブル",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "【ブラウザが開かない】",
      "  → ブラウザに「http://127.0.0.1:3001」と手入力してください",
      "",
      "【「セキュリティの警告」が出て .bat を実行できない】",
      "  → ファイルを右クリック →「プロパティ」→「セキュリティ」の",
      "    「許可する」にチェックを入れて OK → もう一度実行",
      "",
      "【note へのログインが弾かれる】",
      "  → ブラウザで手動で note にログインしてから「診断」→「再診断」を押す",
      "",
      "【記事生成でエラーが出る】",
      "  → 「設定」→ AI プロバイダの「接続テスト」を押して API キーを確認",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ データの保存場所",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "すべてのデータ（記事・設定・ログイン情報）は",
      "このフォルダの中の「data」フォルダに保存されます。",
      "",
      "バックアップは「data」フォルダをコピーするだけです。",
      "このフォルダごと移動しても問題ありません。",
    ].join("\n") + "\n";
    await fs.writeFile(path.join(releaseDir, "start-note-local.bat"), startBat, "utf8");
    await fs.writeFile(path.join(releaseDir, "start-note-local-headless.bat"), startHeadlessBat, "utf8");
    await fs.writeFile(path.join(releaseDir, "README_FIRST.txt"), firstReadme, "utf8");
  } else {
    const startSh = `#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\n# Fix permissions lost when zipped on Windows\nif [ -f "$DIR/runtime/bin/node" ] && [ ! -x "$DIR/runtime/bin/node" ]; then\n  chmod +x "$DIR/runtime/bin/node"\nfi\nexport ENV_FILE_PATH="$DIR/.env"\nexport APP_DATA_DIR="$DIR/data"\nexport PLAYWRIGHT_BROWSERS_PATH="$DIR/ms-playwright"\nexport SERVE_WEB_FROM_SERVER=true\nexport WEB_DIST_DIR="$DIR/saas-hub/dist"\nexport OPEN_BROWSER_ON_START=true\nif [ -f "$DIR/runtime/bin/node" ]; then\n  "$DIR/runtime/bin/node" "$DIR/apps/server/dist/apps/server/src/server.js"\nelse\n  node "$DIR/apps/server/dist/apps/server/src/server.js"\nfi\n`;
    const startHeadlessSh = startSh.replace("export OPEN_BROWSER_ON_START=true", "export OPEN_BROWSER_ON_START=false");
    const setupSh = `#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\necho "=== note-local セットアップ ==="\n# Fix permissions lost when zipped on Windows\nchmod +x "$DIR/"*.sh 2>/dev/null || true\nif [ -f "$DIR/runtime/bin/node" ]; then\n  chmod +x "$DIR/runtime/bin/node"\nfi\necho "Chromium をインストール中..."\nexport PLAYWRIGHT_BROWSERS_PATH="$DIR/ms-playwright"\nif [ -f "$DIR/runtime/bin/node" ]; then\n  "$DIR/runtime/bin/node" "$DIR/node_modules/playwright/cli.js" install chromium\nelse\n  node "$DIR/node_modules/playwright/cli.js" install chromium\nfi\necho ""\necho "セットアップ完了！start-note-local.sh でアプリを起動できます。"\n`;
    const archLabel = platformArg === "mac-arm64"
      ? "Mac版 / Apple Silicon"
      : "Mac版 / Intel";
    const archNote = platformArg === "mac-arm64"
      ? ["※ このパッケージは M1 / M2 / M3 など Apple Silicon Mac 専用です", "　 Intel Mac の方は「mac-x64」版をお使いください"]
      : ["※ このパッケージは Intel Mac 専用です", "　 M1 / M2 / M3 など Apple Silicon Mac の方は「mac-arm64」版をお使いください"];
    const firstReadme = [
      `# note記事自動生成アプリ（${archLabel}）`,
      "",
      "キーワードを入れるだけで note 用の記事を生成し、そのまま下書き保存・公開まで",
      "できるローカルアプリです。インストール不要。このフォルダを解凍するだけで動きます。",
      "",
      ...archNote,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 事前に用意するもの",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "□ note アカウント（投稿先）",
      "□ AI の API キー（記事生成に使います）",
      "   ※ Gemini（無料枠あり）がおすすめ",
      "   　 取得先: https://aistudio.google.com/app/apikey",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 初回セットアップ（最初の1回だけ）",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "1. 「setup.command」を右クリック →「開く」→「開く」",
      "   ※ 「開発元を確認できません」と出たら「開く」を押してください",
      "   → Chromium（ブラウザ自動操作エンジン）のダウンロードが始まります",
      "   → 完了まで数分かかります",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 起動方法",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "1. 「start-note-local.command」を右クリック →「開く」→「開く」",
      "   ※ 初回のみ「開く」が必要です。2回目以降はダブルクリックで起動できます",
      "2. Terminal が開いてサーバーが起動します → そのまま閉じないでください",
      "3. ブラウザで http://127.0.0.1:3001 が自動で開きます",
      "   → 開かない場合はブラウザで上記 URL を手動で開いてください",
      "",
      "▶ 終了するときは Terminal ウィンドウを閉じてください",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 初回の設定（最初の1回だけ）",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "ブラウザが開いたら「設定」画面から以下を入力して保存してください。",
      "",
      "【AIプロバイダの設定】",
      "  → 「Gemini」を選択し、API キーを入力 → 「保存」",
      "",
      "【note アカウントの設定】",
      "  → note のログイン ID（メールアドレス）とパスワードを入力 → 「保存」",
      "",
      "設定が終わったら「診断」画面で「再診断」を押して、",
      "すべて ✅ になっていれば準備完了です。",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ 使い方（基本）",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "1. トップ画面（生成）でキーワードを入力",
      "2. 「生成後下書き」または「生成後即公開」をクリック",
      "3. 記事が生成されたら内容を確認して完了",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ よくあるトラブル",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "【「開発元を確認できません」で .command が起動できない】",
      "",
      "  ▼ 方法1: System Settings から許可する（おすすめ）",
      "    1. .command をダブルクリック（一度ブロックされる）",
      "    2. システム設定 → プライバシーとセキュリティ を開く",
      "    3. 下部に「\"start-note-local.command\" は〜」と表示される",
      "    4. 「このまま開く」をクリック → もう一度 .command をダブルクリック",
      "",
      "  ▼ 方法2: Terminal でまとめて解除する",
      "    1. Launchpad → Terminal を開く",
      "    2. 以下のコマンドを貼り付けて Enter",
      `       xattr -cr ~/Downloads/note-local-draft-studio-portable-${platformArg}`,
      "       （フォルダを別の場所に置いた場合はパスを変えてください）",
      "    3. その後 .command のダブルクリックが普通に動きます",
      "",
      "  ▼ 方法3: Terminal から直接 .sh で起動する",
      "    1. Terminal を開く",
      "    2. フォルダをそのまま Terminal へドラッグ＆ドロップ",
      "       → cd コマンドが自動で入力される → Enter",
      "    3. 以下を入力して Enter",
      "       bash start-note-local.sh",
      "    4. ブラウザで http://127.0.0.1:3001 を開く",
      "",
      "【ブラウザが開かない】",
      "  → ブラウザに「http://127.0.0.1:3001」と手入力してください",
      "",
      "【note へのログインが弾かれる】",
      "  → ブラウザで手動で note にログインしてから「診断」→「再診断」を押す",
      "",
      "【記事生成でエラーが出る】",
      "  → 「設定」→ AI プロバイダの「接続テスト」を押して API キーを確認",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "■ データの保存場所",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "すべてのデータ（記事・設定・ログイン情報）は",
      "このフォルダの中の「data」フォルダに保存されます。",
      "",
      "バックアップは「data」フォルダをコピーするだけです。",
      "このフォルダごと移動しても問題ありません。",
    ].join("\n") + "\n";
    // .sh と .command（Finderダブルクリック用）の両方を生成
    const shPath = path.join(releaseDir, "start-note-local.sh");
    const shHeadlessPath = path.join(releaseDir, "start-note-local-headless.sh");
    const setupShPath = path.join(releaseDir, "setup.sh");
    const commandPath = path.join(releaseDir, "start-note-local.command");
    const setupCommandPath = path.join(releaseDir, "setup.command");
    await fs.writeFile(shPath, startSh, "utf8");
    await fs.writeFile(shHeadlessPath, startHeadlessSh, "utf8");
    await fs.writeFile(setupShPath, setupSh, "utf8");
    await fs.writeFile(commandPath, startSh, "utf8");
    await fs.writeFile(setupCommandPath, setupSh, "utf8");
    await fs.writeFile(path.join(releaseDir, "README_FIRST.txt"), firstReadme, "utf8");
    // Windowsでchmodは効かないが tar.gz 内でパーミッションを保持するため設定
    for (const p of [shPath, shHeadlessPath, setupShPath, commandPath, setupCommandPath]) {
      await fs.chmod(p, 0o755);
    }
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

const fixNativeModulesForMac = async () => {
  if (!isMac) return;

  // When npm install runs on Windows, it downloads Windows prebuilt binaries.
  // For Mac builds we must replace them with the correct darwin prebuilt.
  const bsq3PkgPath = path.join(releaseDir, "node_modules", "better-sqlite3", "package.json");
  let bsq3Version;
  try {
    const pkg = JSON.parse(await fs.readFile(bsq3PkgPath, "utf8"));
    bsq3Version = pkg.version;
  } catch {
    console.log("[fixNativeModules] better-sqlite3 not found, skipping");
    return;
  }

  const arch = platformArg === "mac-arm64" ? "arm64" : "x64";
  // process.versions.modules == node ABI of the current (build) node, which matches the bundled runtime
  const abi = process.versions.modules;
  const prebuiltName = `better-sqlite3-v${bsq3Version}-node-v${abi}-darwin-${arch}.tar.gz`;
  const downloadUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${bsq3Version}/${prebuiltName}`;

  console.log(`[fixNativeModules] Downloading ${prebuiltName}...`);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${prebuiltName}: HTTP ${response.status} from ${downloadUrl}`);
  }

  // Write tar to releaseDir so we can use relative paths with cwd (Windows tar chokes on "C:" in paths)
  await fs.writeFile(path.join(releaseDir, prebuiltName), Buffer.from(await response.arrayBuffer()));
  await fs.mkdir(path.join(releaseDir, "_bsq3_tmp"), { recursive: true });
  await run("tar", ["xzf", prebuiltName, "-C", "_bsq3_tmp"], { cwd: releaseDir });

  // Find the .node binary in the extracted dir (tarball structure varies by version)
  const findNodeFile = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(".node")) return p;
      if (entry.isDirectory()) { const f = await findNodeFile(p); if (f) return f; }
    }
    return null;
  };
  const nodeSrc = await findNodeFile(path.join(releaseDir, "_bsq3_tmp"));
  if (!nodeSrc) throw new Error("Could not find .node file in better-sqlite3 prebuilt tarball");

  const bsq3Dir = path.join(releaseDir, "node_modules", "better-sqlite3");
  // 1. build/Release/better_sqlite3.node  — loaded by node-bindings
  const buildReleaseDir = path.join(bsq3Dir, "build", "Release");
  await fs.mkdir(buildReleaseDir, { recursive: true });
  await fs.cp(nodeSrc, path.join(buildReleaseDir, "better_sqlite3.node"));
  // 2. prebuilds/darwin-{arch}/node.napi.node — loaded by node-gyp-build
  const prebuildsDir = path.join(bsq3Dir, "prebuilds", `darwin-${arch}`);
  await fs.mkdir(prebuildsDir, { recursive: true });
  await fs.cp(nodeSrc, path.join(prebuildsDir, "node.napi.node"));

  await fs.rm(path.join(releaseDir, prebuiltName), { force: true });
  await fs.rm(path.join(releaseDir, "_bsq3_tmp"), { recursive: true, force: true });
  console.log(`[fixNativeModules] better-sqlite3 darwin-${arch} (ABI ${abi}) installed at build/Release/ and prebuilds/`);
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

const archiveMac = async () => {
  // tar.gz で配布（Unix パーミッションが保持される = .command ダブルクリックがそのまま動く）
  // Windows の tar は絶対パス（C:\...）を受け付けないため cwd + 相対パスで実行する
  const archName = platformArg === "mac-arm64" ? "note-arm64.tar.gz" : "note-x64.tar.gz";
  const parentDir = path.dirname(releaseDir);
  const folderName = path.basename(releaseDir);
  const outPath = path.join(parentDir, archName);
  console.log(`[archive] Creating ${archName}...`);
  await run("tar", ["czf", archName, folderName], { cwd: parentDir });
  console.log(`[archive] Done: ${outPath}`);
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
  await copy(path.join(rootDir, "README.md"), path.join(releaseDir, "README.md"));
  await copy(path.join(rootDir, "TEST_RESULTS.md"), path.join(releaseDir, "TEST_RESULTS.md"));
  await fs.mkdir(path.join(releaseDir, "data"), { recursive: true });
  await installRuntimeDependencies();
  await resolveWorkspaceSymlinks();
  await stripWorkspacesFromPackageJson();
  await fixNativeModulesForMac();
  if (!isMac) await installPlaywrightBrowser();
  await bundleNodeRuntime();
  await writeLaunchers();
  if (isMac) await archiveMac();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
