import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: 'terser', // Enable aggressive minification
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debug utilities
        drop_debugger: true,
        pure_funcs: ['console.debug'] // Remove debug calls in production
      },
      format: {
        comments: false // Remove comments
      }
    },
    rollupOptions: {
      input: {
        background: 'src/background.js',
        popup: 'src/popup.html',
        options: 'src/options.html',
        maze: 'src/maze.html',
        blob: 'src/blob.html'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'shared/[name]-[hash:8].js', // Better caching for shared chunks
        assetFileNames: (assetInfo) => {
          // Organize assets by type
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].css';
          }
          return 'assets/[name].[ext]';
        },
        manualChunks: {
          // Bundle shared utilities together for better caching
          'shared-utils': ['./src/constants.js', './src/utils.js', './src/env.js'],
          'ui-utils': ['./src/ui-utils.js', './src/debug.js'],
          'data-store': ['./src/usage-data-store.js']
        }
      },
      // External dependencies that shouldn't be bundled (Chrome APIs)
      external: ['chrome']
    },
    copyPublicDir: false,
    // Optimize chunk size warnings for extension context
    chunkSizeWarningLimit: 1000 // 1MB limit reasonable for extensions
  }
});

