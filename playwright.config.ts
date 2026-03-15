import { defineConfig } from "@playwright/test";

const appPort = Number(process.env.APP_PORT ?? "3001");
const webPort = Number(process.env.WEB_PORT ?? "4173");

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "node apps/server/dist/apps/server/src/server.js",
      port: appPort,
      reuseExistingServer: true,
      env: {
        ...process.env,
        APP_PORT: String(appPort),
        APP_DATA_DIR: "./apps/server/data-e2e",
        ENABLE_REAL_NOTE_AUTOMATION: "false",
        MOCK_AI_MODE: "true",
        MOCK_NOTE_API_RESULT: "success",
        MOCK_PLAYWRIGHT_RESULT: "success",
        MOCK_PINCHTAB_RESULT: "success"
      }
    },
    {
      command: "npm run preview --workspace @note-local/web -- --host 127.0.0.1 --port 4173",
      port: webPort,
      reuseExistingServer: true,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://127.0.0.1:${appPort}/api`
      }
    }
  ]
});
