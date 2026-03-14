import { defineConfig } from "orval";

export default defineConfig({
  pointManager: {
    input: "../contracts/openapi/point-manager.json",
    output: {
      mode: "split",
      target: "./src/generated/client.ts",
      schemas: "./src/generated/models",
      client: "axios",
      clean: true,
      mock: false,
    },
  },
});
