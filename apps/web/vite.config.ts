import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../../", "");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        process.env.VITE_API_URL ?? env.VITE_API_URL ?? "http://localhost:5000/api/v1",
      ),
    },
    envDir: "../../",
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      watch: {
        ignored: ["**/dist/**", "**/test-results/**", "**/playwright-report/**"],
      },
    },
  };
});
