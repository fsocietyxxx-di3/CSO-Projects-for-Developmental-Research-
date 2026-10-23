import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[api] listening on :${env.PORT} (${env.NODE_ENV})`);
  console.log(`[api] health check: http://localhost:${env.PORT}/api/v1/health`);
});
