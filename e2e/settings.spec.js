import { test, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
})

test('PNG-export produceert een niet-triviaal bestand', async ({ page }) => {
  await page.click('text=Netwerkweergave')
  await page.waitForTimeout(400)
  await page.click('[title="Instellingen & privacy"]')
  await page.waitForTimeout(200)
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.click('button:has-text("Exporteer huidige weergave als afbeelding")')
  const download = await downloadPromise
  const p = await download.path()
  expect(fs.statSync(p).size).toBeGreaterThan(1000)
})

test('JSON export/import round-trip', async ({ page }) => {
  await page.click('[title="Instellingen & privacy"]')
  await page.waitForTimeout(200)
  const downloadPromise = page.waitForEvent('download')
  await page.click('button:has-text("Exporteer alle data als JSON")')
  const download = await downloadPromise
  const p = await download.path()
  const exported = JSON.parse(fs.readFileSync(p, 'utf-8'))
  expect(exported).toHaveProperty('teams')
  expect(exported).toHaveProperty('dependencies')
  expect(exported).toHaveProperty('teamWorkflows')
  expect(exported).toHaveProperty('customCategories')
  expect(exported).toHaveProperty('customRoles')

  const customState = {
    teams: ['E2E Import Team'],
    dependencies: [{
      id: 'e2e-import-1', team: 'E2E Import Team', scope: 'intern', categorie: 'Kennis-concentratie',
      titel: 'E2E geimporteerde dependency', toelichting: '', rol_betrokkene: 'Tester', impact: 'hoog',
      frequentie: 'vaak', status: 'bekend risico', mitigatie: '', laatst_bijgewerkt: '2026-01-01',
    }],
    teamWorkflows: {},
    customCategories: { intern: [], extern: [] },
    customRoles: [],
    usingMockData: false,
  }
  const tmpFile = path.join(os.tmpdir(), 'e2e-import-test.json')
  fs.writeFileSync(tmpFile, JSON.stringify(customState))
  if ((await page.locator('input[type=file]').count()) === 0) {
    await page.click('[title="Instellingen & privacy"]')
    await page.waitForTimeout(200)
  }
  await page.locator('input[type=file]').setInputFiles(tmpFile)
  await page.waitForTimeout(400)

  const stateAfterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(stateAfterImport.teams).toEqual(['E2E Import Team'])
  expect(stateAfterImport.dependencies).toHaveLength(1)
  expect(stateAfterImport.teamWorkflows['E2E Import Team']).toBeTruthy()
  expect(Array.isArray(stateAfterImport.teamWorkflows['E2E Import Team'].applications)).toBe(true)
})

test('terug naar mockdata herstelt de demo-teams', async ({ page }) => {
  await page.click('[title="Instellingen & privacy"]')
  await page.waitForTimeout(200)
  await page.click('button:has-text("Wis alle data")')
  await page.waitForTimeout(200)
  await page.click('button:has-text("Bevestig wissen")')
  await page.waitForTimeout(300)

  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teams).toHaveLength(0)

  if ((await page.locator('button:has-text("Terug naar mock data")').count()) === 0) {
    await page.click('[title="Instellingen & privacy"]')
    await page.waitForTimeout(200)
  }
  await page.click('button:has-text("Terug naar mock data")')
  await page.waitForTimeout(300)

  state = await page.evaluate(() => JSON.parse(localStorage.getItem('dependency-insight:v1')))
  expect(state.teams).toContain('Team Equinox')
  expect(state.usingMockData).toBe(true)
})
