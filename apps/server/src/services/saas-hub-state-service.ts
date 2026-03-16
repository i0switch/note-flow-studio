import fs from "node:fs/promises";
import path from "node:path";
import { resolveDataPath } from "../config.js";

const STATE_FILE = "saas-hub-state.json";

export class SaasHubStateService {
  private readonly filePath: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolveDataPath(STATE_FILE);
  }

  async load(): Promise<Record<string, unknown> | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async save(state: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmp, this.filePath);
  }

  /**
   * 排他的に sidecar を更新する。
   * 並行書き込みによる deletedJobIds 上書きを防ぐため、
   * write lock キューに追加してから load → merge → save する。
   */
  async updateSidecar(
    updater: (existing: Record<string, unknown>) => Record<string, unknown>
  ): Promise<void> {
    const task = this.writeLock.then(async () => {
      const existing = (await this.load()) ?? {};
      const next = updater(existing);
      await this.save(next);
    });
    // lock は task が失敗しても resolved に戻す（汚染防止）
    // caller には失敗が伝わる（silent failure 防止）
    this.writeLock = task.catch(() => {});
    return task;
  }
}
