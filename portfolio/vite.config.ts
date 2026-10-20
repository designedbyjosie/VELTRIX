import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as never);
