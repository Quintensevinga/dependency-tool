import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // reactflow (het grootste losse pakket) en de React-runtime in eigen
        // vendor-chunks i.p.v. alles in één bundel — cachet apart van de
        // eigen app-code, die met elke release toch al verandert. Zie B-18.
        // Functievorm i.p.v. een object: deze Vite-versie bundelt met
        // rolldown, dat (anders dan rollup) alleen de functievorm accepteert.
        manualChunks(id) {
          if (id.includes('node_modules/reactflow')) return 'reactflow'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor'
        },
      },
    },
  },
})
