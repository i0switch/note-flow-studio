import { spawn } from "node:child_process";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const workspaceRoot = process.cwd().toLowerCase().replaceAll("/", "\\");

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `COMMAND_FAILED ${command} ${args.join(" ")}\n${stderr || stdout}`.trim()
        )
      );
    });
  });

const normalizeProcessList = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [parsed];
};

const truncate = (value, max = 160) => {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
};

const classifyManagedProcess = (commandLine = "") => {
  const normalized = commandLine.toLowerCase().replaceAll("/", "\\");
  const isWorkspaceProcess = normalized.includes(workspaceRoot);

  if (
    isWorkspaceProcess &&
    normalized.includes("vite") &&
    normalized.includes("preview") &&
    (normalized.includes(`${workspaceRoot}\\apps\\web`) ||
      normalized.includes(`${workspaceRoot}\\node_modules\\vite\\bin\\vite.js`) ||
      normalized.includes("--workspace @note-local/web"))
  ) {
    return "vite preview";
  }

  if (
    normalized.includes("tsx") &&
    (normalized.includes(`${workspaceRoot}\\apps\\server\\src\\server.ts`) ||
      normalized.includes("apps\\server\\src\\server.ts") ||
      normalized.includes(`${workspaceRoot}\\server\\index.ts`) ||
      normalized.includes("server\\index.ts"))
  ) {
    return "tsx server";
  }

  if (
    (normalized.includes(`${workspaceRoot}\\apps\\server\\dist`) ||
      normalized.includes("apps\\server\\dist\\apps\\server\\src\\server.js")) &&
    normalized.includes("server.js")
  ) {
    return "built server";
  }

  if (
    normalized.includes(`${workspaceRoot}\\release\\note-local-draft-studio-portable`) &&
    normalized.includes("server.js")
  ) {
    return "portable server";
  }

  return null;
};

const listListeningProcessesWindows = async (port) => {
  const script = [
    `$connections = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue`,
    "if (-not $connections) { exit 0 }",
    "$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique",
    "$processes = Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | Select-Object ProcessId, Name, CommandLine",
    "if (-not $processes) { exit 0 }",
    "$processes | ConvertTo-Json -Compress",
    "exit 0"
  ].join("; ");

  const { stdout } = await runCommand(
    "powershell.exe",
    ["-NoProfile", "-Command", script],
    { windowsHide: true }
  );

  return normalizeProcessList(stdout).map((item) => ({
    pid: Number(item.ProcessId),
    name: item.Name ?? "unknown",
    commandLine: item.CommandLine ?? ""
  }));
};

const listListeningProcesses = async (port) => {
  if (process.platform === "win32") {
    return listListeningProcessesWindows(port);
  }

  try {
    const { stdout } = await runCommand(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpcn"],
      { windowsHide: true }
    );

    const entries = [];
    let current = {};
    for (const line of stdout.split(/\r?\n/)) {
      if (!line) continue;
      const prefix = line[0];
      const value = line.slice(1);
      if (prefix === "p") {
        if (current.pid) entries.push(current);
        current = { pid: Number(value), name: "unknown", commandLine: "" };
      } else if (prefix === "c") {
        current.name = value;
      } else if (prefix === "n") {
        current.commandLine = value;
      }
    }
    if (current.pid) entries.push(current);
    return entries;
  } catch {
    return [];
  }
};

const dedupeProcesses = (processes) => {
  const seen = new Set();
  return processes.filter((processInfo) => {
    if (seen.has(processInfo.pid)) return false;
    seen.add(processInfo.pid);
    return true;
  });
};

const formatProcessLine = (processInfo) => {
  const managedKind = classifyManagedProcess(processInfo.commandLine);
  const summary = truncate(processInfo.commandLine || processInfo.name);
  return `PID ${processInfo.pid} / ${processInfo.name}${managedKind ? ` / ${managedKind}` : ""}${summary ? ` / ${summary}` : ""}`;
};

const waitForPortRelease = async (port, timeoutMs = 5_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const processes = dedupeProcesses(await listListeningProcesses(port));
    if (processes.length === 0) return;
    await wait(250);
  }

  throw new Error(`PORT_RELEASE_TIMEOUT:${port}`);
};

const stopManagedProcesses = async (port, processes, logger) => {
  const managed = dedupeProcesses(
    processes.filter((processInfo) => classifyManagedProcess(processInfo.commandLine))
  );

  for (const processInfo of managed) {
    logger(
      `[port-guard] Port ${port} を占有していた既存プロセスを停止する: ${formatProcessLine(processInfo)}`
    );
    process.kill(processInfo.pid);
  }

  await waitForPortRelease(port);
};

const buildConflictError = (port, processes) => {
  const lines = [
    `Port ${port} が使用中だった。自動停止できるのはこのプロジェクト由来の Node / vite preview / tsx server のみ。`,
    ...dedupeProcesses(processes).map((processInfo) => `- ${formatProcessLine(processInfo)}`),
    `このポートを空けてから再実行して。`
  ];
  return new Error(lines.join("\n"));
};

export const ensurePortsAvailable = async (
  ports,
  { autoKillManaged = true, logger = console.log } = {}
) => {
  for (const port of ports) {
    const processes = dedupeProcesses(await listListeningProcesses(port));
    if (processes.length === 0) continue;

    const hasUnknownProcess = processes.some(
      (processInfo) => !classifyManagedProcess(processInfo.commandLine)
    );

    if (!autoKillManaged || hasUnknownProcess) {
      throw buildConflictError(port, processes);
    }

    await stopManagedProcesses(port, processes, logger);
  }
};

export const describePortUsage = async (port) => {
  const processes = dedupeProcesses(await listListeningProcesses(port));
  if (processes.length === 0) return `Port ${port} は未使用`;
  return [`Port ${port} は使用中`, ...processes.map((item) => `- ${formatProcessLine(item)}`)].join("\n");
};
