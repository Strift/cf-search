import path from "node:path";
import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidVue } from "@void/vue/plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [voidPlugin(), voidVue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  fmt: {
    ignorePatterns: ["db/migrations/**"],
  },
});
