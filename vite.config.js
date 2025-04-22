import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  base: '/showswatched2/', // This line ensures correct asset paths for GitHub Pages
  plugins: [react()],
})
