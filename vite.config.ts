import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime'],
  },
  server: {
    host: '127.0.0.1',
  },
})
