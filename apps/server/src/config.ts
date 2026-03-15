import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const envFilePath = process.env.ENV_FILE_PATH
  ? path.resolve(process.cwd(), process.env.ENV_FILE_PATH)
  : path.resolve(process.cwd(), ".env");

loadEnv({ path: envFilePath });

const envSchema = z.object({
  ENV_FILE_PATH: z.string().default(envFilePath),
  APP_PORT: z.coerce.number().default(3001),
  APP_DATA_DIR: z.string().default("./data"),
  DEFAULT_AI_PROVIDER: z.string().default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  ENABLE_REAL_NOTE_AUTOMATION: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  NOTE_LOGIN_ID: z.string().optional(),
  NOTE_LOGIN_PASSWORD: z.string().optional(),
  NOTE_UNOFFICIAL_API_URL: z.string().optional(),
  NOTE_UNOFFICIAL_API_TOKEN: z.string().optional(),
  PINCHTAB_BASE_URL: z.string().default("http://localhost:9867"),
  PINCHTAB_TOKEN: z.string().optional(),
  PINCHTAB_PROFILE_NAME: z.string().default("note-live"),
  PINCHTAB_LAUNCH_PORT: z.coerce.number().default(9870),
  SERVE_WEB_FROM_SERVER: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  WEB_DIST_DIR: z.string().default("./saas-hub/dist"),
  OPEN_BROWSER_ON_START: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  PLAYWRIGHT_HEADLESS: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  MOCK_AI_MODE: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  MOCK_NOTE_API_RESULT: z.enum(["success", "fail"]).default("success"),
  MOCK_PLAYWRIGHT_RESULT: z.enum(["success", "fail"]).default("success"),
  MOCK_PINCHTAB_RESULT: z.enum(["success", "fail"]).default("success")
});

export const env = envSchema.parse(process.env);

export const resolveDataPath = (...segments: string[]) =>
  path.resolve(process.cwd(), env.APP_DATA_DIR, ...segments);

export const resolveEnvFilePath = () => path.resolve(process.cwd(), env.ENV_FILE_PATH);

export const resolveWebDistPath = () => path.resolve(process.cwd(), env.WEB_DIST_DIR);
