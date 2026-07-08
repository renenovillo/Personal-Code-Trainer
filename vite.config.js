import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANTE: 'base' debe coincidir con el nombre de tu repositorio en GitHub.
export default defineConfig({
  plugins: [react()],
  base: '/Personal-Code-Trainer/',
})
