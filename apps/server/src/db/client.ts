import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { resolveDataPath } from "../config.js";
import * as schema from "./schema.js";

export const createDatabase = (dbPath = resolveDataPath("app.db")) => {
  fs.mkdirSync(resolveDataPath(), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
};

export type AppDatabase = ReturnType<typeof createDatabase>;
