import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// defineConfig komt uit vitest/config i.p.v. vite: dat is dezelfde functie,
// maar met het test-blok hieronder erin herkend. Eén configuratie voor build
// én tests, zodat er geen tweede vitest.config.js naast komt te staan die uit
// de pas kan lopen. De define/plugins hieronder werken er ongewijzigd in.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Identificeert de gebouwde versie. Op Vercel levert de omgeving de commit
// mee; lokaal valt het terug op git zelf en anders op het buildmoment (bv.
// een export zonder .git). Wordt zowel in de app gebakken (__APP_VERSION__)
// als naast de app gepubliceerd (/version.json), zodat een tab die al uren
// openstaat kan zien dat er inmiddels iets nieuwers live staat.
function buildVersion() {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  if (fromCi) return fromCi.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return `t${Date.now().toString(36)}`
  }
}

// Vingerafdruk van de meegeleverde voorbeelddata. Bewust een hash van het
// bestand i.p.v. een handmatig opgehoogd versienummer: dat laatste moet je
// bij élke inhoudelijke wijziging onthouden, en precies dát vergeten laat
// bestaande demo-bezoekers stilzwijgend op oude data zitten (zie
// MOCK_DATA_SIGNATURE in lib/storage.js).
function mockDataSignature() {
  const file = fileURLToPath(new URL('./src/data/mockData.js', import.meta.url))
  return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 12)
}

// Publiceert /version.json met dezelfde versie als de gebouwde app, en
// serveert dat bestand ook tijdens `npm run dev` — anders werkt de
// nieuwe-versie-melding alleen in productie en kun je hem nooit uitproberen.
function versionManifest(version, builtAt) {
  const body = `${JSON.stringify({ version, builtAt }, null, 2)}\n`
  return {
    name: 'dependency-insight-version-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body })
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
      })
    },
  }
}

const APP_VERSION = buildVersion()
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), versionManifest(APP_VERSION, BUILD_TIME)],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __MOCK_DATA_SIGNATURE__: JSON.stringify(mockDataSignature()),
  },
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
