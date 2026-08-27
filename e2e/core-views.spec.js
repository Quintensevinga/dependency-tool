import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
})

test('matrix-overzicht toont tabel met rijen', async ({ page }) => {
  await page.click('text=Matrix-overzicht')
  await expect(page.locator('table')).toHaveCount(1)
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

test('netwerkweergave toont nodes en edges', async ({ page }) => {
  await page.click('text=Netwerkweergave')
  await page.waitForTimeout(400)
  const nodeCount = await page.locator('.react-flow__node').count()
  const edgeCount = await page.locator('.react-flow__edge').count()
  expect(nodeCount).toBeGreaterThan(0)
  expect(edgeCount).toBeGreaterThan(0)
})

test('ketenoverzicht toont nodes', async ({ page }) => {
  await page.click('text=Ketenoverzicht')
  await page.waitForTimeout(400)
  const nodeCount = await page.locator('.react-flow__node').count()
  expect(nodeCount).toBeGreaterThan(0)
})

test('taalwissel (NL/EN) past UI-tekst aan zonder de scope-toggle te raken', async ({ page }) => {
  const scopeBefore = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')]
    const b = btns.find((x) => x.className.includes('bg-[#33493c]') && (x.textContent === 'Teamniveau' || x.textContent === 'Ketenniveau'))
    return b?.textContent
  })
  await page.getByRole('button', { name: 'en', exact: true }).click()
  await page.waitForTimeout(200)
  await expect(page.locator('body')).toContainText('New dependency')
  await page.getByRole('button', { name: 'nl', exact: true }).click()
  await page.waitForTimeout(200)
  const scopeAfter = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')]
    const b = btns.find((x) => x.className.includes('bg-[#33493c]') && (x.textContent === 'Teamniveau' || x.textContent === 'Ketenniveau'))
    return b?.textContent
  })
  expect(scopeAfter).toBe(scopeBefore)
})
