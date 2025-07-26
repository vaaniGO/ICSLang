// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // Point to parent node_modules if needed
            '@': path.resolve(__dirname, '../node_modules')
        }
    }
})