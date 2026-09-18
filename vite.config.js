// defineConfig komt hier uit vitest/config i.p.v. vite: dat is dezelfde
// functie, maar met het test-blok hieronder erin herkend. Eén configuratie
// voor build én tests, zodat er geen tweede vitest.config.js naast komt te
// staan die uit de pas kan lopen.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // 'node' en niet 'jsdom': de tests hier raken bewust geen scherm en geen
    // DOM — het zijn rekentests op het risicomodel en de datamigratie (zie
    // src/lib/*.test.js). jsdom zou alleen opstarttijd kosten.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
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
