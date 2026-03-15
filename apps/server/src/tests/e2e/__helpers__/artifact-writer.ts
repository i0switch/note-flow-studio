import fs from "node:fs/promises";
import path from "node:path";

export type LogEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  test: string;
  step: string;
  statusCode?: number;
  draftUrl?: string;
  method?: string;
  durationMs?: number;
  error?: string;
};

export type ResultEntry = {
  test: string;
  status: "passed" | "failed" | "skipped";
  draftUrl?: string;
  methodUsed?: string;
  cleanupStatus?: "success" | "failed" | "skipped";
  error?: string;
};

export type ResponseSummary = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  mode: "mock" | "live";
  results: ResultEntry[];
};

const SECRET_KEY = /api_?key|token|password|secret|session|cookie/i;

function sanitize(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : sanitize(v);
  }
  return out;
}

/** Repo-root relative artifacts/<runId>/ writer. */
export class ArtifactWriter {
  private readonly results: ResultEntry[] = [];

  private constructor(
    public readonly runId: string,
    public readonly artifactDir: string,
    private readonly startedAt: string,
    public readonly mode: "mock" | "live"
  ) {}

  static async init(runId: string, mode: "mock" | "live"): Promise<ArtifactWriter> {
    // CWD is apps/server when running vitest, so ../../ = repo root
    const dir = path.resolve(process.cwd(), "..", "..", "artifacts", runId);
    await fs.mkdir(dir, { recursive: true });
    return new ArtifactWriter(runId, dir, new Date().toISOString(), mode);
  }

  async appendLog(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(sanitize(entry)) + "\n";
    await fs.appendFile(path.join(this.artifactDir, "execution.log"), line, "utf8").catch(() => {});
  }

  async saveHtml(name: string, html: string): Promise<string> {
    const p = path.join(this.artifactDir, `${name}.html`);
    await fs.writeFile(p, html, "utf8");
    return p;
  }

  async saveScreenshot(name: string, buffer: Buffer): Promise<string> {
    const p = path.join(this.artifactDir, `${name}.png`);
    await fs.writeFile(p, buffer);
    return p;
  }

  recordResult(entry: ResultEntry): void {
    this.results.push(entry);
  }

  async writeSummary(): Promise<void> {
    const summary: ResponseSummary = {
      runId: this.runId,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      mode: this.mode,
      results: this.results,
    };
    await fs.writeFile(
      path.join(this.artifactDir, "summary.json"),
      JSON.stringify(sanitize(summary), null, 2),
      "utf8"
    );
  }
}
