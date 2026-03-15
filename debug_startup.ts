
import { buildApp } from "./apps/server/src/app.js";
import { env } from "./apps/server/src/config.js";

async function debug() {
  console.log("Starting debug startup...");
  console.log("Env config:", JSON.stringify({
    APP_PORT: env.APP_PORT,
    APP_DATA_DIR: env.APP_DATA_DIR,
    MOCK_AI_MODE: env.MOCK_AI_MODE
  }, null, 2));

  try {
    console.log("Building app...");
    const app = await buildApp();
    console.log("App built successfully. Starting listen...");
    
    await app.listen({ port: env.APP_PORT, host: "0.0.0.0" });
    console.log(`Server listening on port ${env.APP_PORT}`);
  } catch (error) {
    console.error("FATAL ERROR DURING STARTUP:");
    console.error(error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
  }
}

debug().catch(err => {
  console.error("Unhandled promise rejection in debug script:");
  console.error(err);
});
