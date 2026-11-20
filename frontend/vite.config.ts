import os from 'node:os'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const api = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000'

/** This machine's Wi-Fi/LAN address, so QR codes made on "localhost" still open on a phone. */
const lanIp = Object.values(os.networkInterfaces()).flat()
  .find((n) => n && n.family === 'IPv4' && !n.internal && /^(192\.168|10|172\.(1[6-9]|2\d|3[01]))\./.test(n.address))?.address

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __LAN_ORIGIN__: JSON.stringify(lanIp ? `http://${lanIp}:5173` : '') },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5173,
    strictPort: true, // fail loudly instead of silently moving to 5174
    host: true, // reachable from phones on the same network
    allowedHosts: true, // allow tunnel hostnames (e.g. cloudflared) during the usability study
    // The browser only ever talks to this server; it forwards API and media calls to Django.
    // Works the same on localhost, a LAN IP or a tunnel — no CORS, no hard-coded hosts.
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/media': { target: api, changeOrigin: false },
    },
  },
  preview: { proxy: { '/api': api, '/media': api } },
})
