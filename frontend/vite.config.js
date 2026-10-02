import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    envDir: fileURLToPath(new URL("../backend", import.meta.url)),
    plugins: [
        react(), 
        tailwindcss()
    ],
});
