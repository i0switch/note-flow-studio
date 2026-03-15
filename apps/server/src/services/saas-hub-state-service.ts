import fs from "node:fs/promises";
import path from "node:path";
import { resolveDataPath } from "../config.js";

const STATE_FILE = "saas-hub-state.json";

export class SaasHubStateService {
  private readonly filePath: string;

  constructor() {
    this.filePath = resolveDataPath(STATE_FILE);
  }

  async load(): Promise<Record<string, unknown> | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async save(state: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = this.filePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(tmp, this.filePath);
  }
}
