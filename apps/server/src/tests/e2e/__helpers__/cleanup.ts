import fs from "node:fs/promises";
import { request as playwrightRequest } from "playwright";
import { resolveDataPath } from "../../../config.js";
import type { ArtifactWriter } from "./artifact-writer.js";

export type CleanupTarget = {
  noteKey: string;
  draftUrl: string;
  label: string;
};

export type CleanupReport = {
  succeeded: string[];
  failed: Array<{ key: string; error: string }>;
};

/**
 * NoteCleanup — deletes E2E test articles from note.com after live tests.
 *
 * - maxAttempts is always 1 (no infinite retry)
 * - Failures are logged to artifact but do NOT fail the test
 * - Only used in live mode; mock mode has nothing to clean up
 */
export class NoteCleanup {
  private readonly targets: CleanupTarget[] = [];

  register(target: CleanupTarget): void {
    this.targets.push(target);
  }

  /** Extract note key from editor URL: https://editor.note.com/notes/<key>/edit/ */
  static keyFromDraftUrl(draftUrl: string): string | null {
    const m = draftUrl.match(/\/notes\/([^/]+)\/edit/);
    return m?.[1] ?? null;
  }

  /** Extract note key from publish URL: https://note.com/<urlname>/n/<key> */
  static keyFromPublishUrl(publishUrl: string): string | null {
    const m = publishUrl.match(/\/n\/([^/?#]+)/);
    return m?.[1] ?? null;
  }

  async run(artifacts?: ArtifactWriter): Promise<CleanupReport> {
    const report: CleanupReport = { succeeded: [], failed: [] };

    if (this.targets.length === 0) return report;

    const sessionPath = resolveDataPath("note-storage-state.json");
    let storageState: unknown;
    try {
      const raw = await fs.readFile(sessionPath, "utf8");
      storageState = JSON.parse(raw);
    } catch {
      const msg = "Cleanup skipped: note-storage-state.json not found";
      await artifacts?.appendLog({
        ts: new Date().toISOString(),
        level: "warn",
        test: "cleanup",
        step: "load-session",
        error: msg,
      });
      for (const t of this.targets) {
        report.failed.push({ key: t.noteKey, error: msg });
      }
      return report;
    }

    const api = await playwrightRequest.newContext({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storageState: storageState as any,
      extraHTTPHeaders: {
        "x-requested-with": "XMLHttpRequest",
        referer: "https://editor.note.com/",
        "content-type": "application/json",
      },
    });

    try {
      for (const target of this.targets) {
        const start = Date.now();
        try {
          const res = await api.delete(
            `https://note.com/api/v1/text_notes/${target.noteKey}`
          );
          const ok = res.status() === 200 || res.status() === 204 || res.status() === 404;
          if (ok) {
            report.succeeded.push(target.noteKey);
            await artifacts?.appendLog({
              ts: new Date().toISOString(),
              level: "info",
              test: "cleanup",
              step: `delete-${target.label}`,
              statusCode: res.status(),
              draftUrl: target.draftUrl,
              durationMs: Date.now() - start,
            });
          } else {
            const body = await res.text().catch(() => "");
            throw new Error(`HTTP ${res.status()}: ${body.slice(0, 120)}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          report.failed.push({ key: target.noteKey, error: msg });
          await artifacts?.appendLog({
            ts: new Date().toISOString(),
            level: "error",
            test: "cleanup",
            step: `delete-${target.label}`,
            draftUrl: target.draftUrl,
            error: msg,
            durationMs: Date.now() - start,
          });
        }
      }
    } finally {
      await api.dispose();
    }

    return report;
  }
}
