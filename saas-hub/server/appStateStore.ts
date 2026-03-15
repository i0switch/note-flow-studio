import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "server", "data");
const stateFile = path.join(dataDir, "app-state.json");

export const loadAppState = async () => {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const saveAppState = async (state: unknown) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
};
