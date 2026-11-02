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
    server: {
        proxy: {
            // The backend serves these paths directly, so forward them; page routes (/course, /team) stay with Vite.
            "^/(repositories|commits|courses|github-app)(/|\\?|$)": "http://localhost:3001",
        },
    },
});
