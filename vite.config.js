import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// 把 web/ 里的前端构建到 static/，由 Express 原样托管。
// base 用 "./"：资源一律走相对路径，部署在子路径下也能用。
export default defineConfig({
  root: fileURLToPath(new URL("./web", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("./static", import.meta.url)),
    emptyOutDir: true,
  },
});
