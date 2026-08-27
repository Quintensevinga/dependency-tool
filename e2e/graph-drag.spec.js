import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Dependency Insight')
  await page.click('text=Netwerkweergave')
  await page.waitForTimeout(500)
})

test('team-node slepen behoudt positie na filter-toggle', async ({ page }) => {
  const teamNode = page.locator('.react-flow__node').filter({ hasText: 'Equinox' }).first()
  const box1 = await teamNode.boundingBox()
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2)
  await page.mouse.down()
  await page.mouse.move(box1.x + 80, box1.y + 60, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const box2 = await teamNode.boundingBox()
  expect(Math.abs(box2.x - box1.x)).toBeGreaterThan(20)

  const otherTeamCheckbox = page.locator('label:has-text("Team Tiem") input[type=checkbox]')
  await otherTeamCheckbox.uncheck()
  await page.waitForTimeout(200)
  await otherTeamCheckbox.check()
  await page.waitForTimeout(200)
  const box3 = await teamNode.boundingBox()
  expect(Math.abs(box3.x - box2.x)).toBeLessThan(5)
})

test('sleep-om-te-verbinden opent voorgevuld dependency-formulier', async ({ page }) => {
  const nodePositions = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.react-flow__node')]
    return nodes.map((n) => {
      const rect = n.getBoundingClientRect()
      const handles = [...n.querySelectorAll('.react-flow__handle')].map((h) => {
        const hr = h.getBoundingClientRect()
        return { x: hr.x + hr.width / 2, y: hr.y + hr.height / 2, source: h.classList.contains('source') }
      })
      return { id: n.dataset.id, handles }
    })
  })
  const equinoxNode = nodePositions.find((n) => n.id === 'team:Team Equinox')
  const catNode = nodePositions.find((n) => n.id?.startsWith('cat:'))
  expect(equinoxNode).toBeTruthy()
  expect(catNode).toBeTruthy()

  const src = equinoxNode.handles.find((h) => h.source) ?? equinoxNode.handles[0]
  const tgt = catNode.handles.find((h) => !h.source) ?? catNode.handles[0]
  await page.mouse.move(src.x, src.y)
  await page.mouse.down()
  await page.mouse.move((src.x + tgt.x) / 2, (src.y + tgt.y) / 2, { steps: 5 })
  await page.mouse.move(tgt.x, tgt.y, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)

  await expect(page.getByRole('heading', { name: 'Nieuwe dependency' })).toBeVisible()
  await expect(page.locator('select').nth(0)).toHaveValue('Team Equinox')
})
