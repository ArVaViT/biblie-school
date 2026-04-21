import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep only the two chunks that genuinely benefit from manual
        // splitting: the React runtime (shared by every route) and the Supabase
        // client (loaded eagerly by AuthContext). The previous `ui` bucket
        // forced a handful of ~2KB utility libs into a separate request for
        // every visitor, and `editor` duplicated the automatic async chunk
        // that already gets created when `RichTextEditor` is dynamically
        // imported from the lazy teacher routes (CourseEditor / ChapterEditor).
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Same-origin proxy for Supabase Storage public objects. Mirrors the
      // Vercel rewrite in frontend/vercel.json so local dev matches prod.
      '/img': {
        target: process.env.VITE_SUPABASE_URL || 'https://rrisqutxlkamwfhcashl.supabase.co',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/img/, '/storage/v1/object/public'),
      },
    },
  },
})

