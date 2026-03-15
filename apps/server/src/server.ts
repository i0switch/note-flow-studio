import { env } from "./config.js";
import { buildApp } from "./app.js";
import { execFile } from "node:child_process";

const app = await buildApp();

await app.listen({ port: env.APP_PORT, host: "0.0.0.0" });

if (env.OPEN_BROWSER_ON_START) {
  const url = `http://127.0.0.1:${env.APP_PORT}`;
  const platform = process.platform;
  if (platform === "win32") {
    execFile("cmd", ["/c", "start", "", url]);
  }
}
