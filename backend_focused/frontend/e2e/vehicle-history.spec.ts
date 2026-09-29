import type { Locator, Page } from '@playwright/test';
import type { VehicleDetail } from '../lib/api/types';
import { expect, test } from './fixtures';

const timestamps = { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const vehicle: VehicleDetail = {
  ...timestamps,
  id: 1,
  vin: 'HISTORY000001',
  license_plate: 'HIS-001',
  make: 'Fleet',
  model: 'History van',
  year: 2026,
  active: true,
  office: { ...timestamps, id: 2, name: 'Central office', city: 'Salvador' },
  maintenance_records: [],
};

function note(id: number) {
  return `Inspection note ${id}.\nComplete technician findings: checked the suspension, brakes, electrical system and all fluid levels.\nFollow-up instructions remain readable in full, including this final sentence.`;
}

function historyRecords(count: number): VehicleDetail['maintenance_records'] {
  // The API orders by date descending, then ID descending (many ties per date).
  return Array.from({ length: count }, (_, index) => {
    const id = count - index;
    return {
      ...timestamps,
      id,
      vehicle: 1,
      mechanic: {
        ...timestamps,
        id: 3,
        name: 'Alex Pereira',
        certification_number: 'CERT-001',
        active: true,
      },
      maintenance_date: `2026-09-${String(Math.ceil(id / (count / 10))).padStart(2, '0')}`,
      maintenance_type: `Service ${id}`,
      cost: '25.50',
      notes: id === count || id === 1 ? note(id) : `Inspection note ${id}.`,
    };
  });
}

async function mockVehicle(page: Page, records: VehicleDetail['maintenance_records']) {
  const attempts: string[] = [];
  const body = JSON.stringify({ ...vehicle, maintenance_records: records });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    attempts.push(`${url.pathname}${url.search}`);
    expect(route.request().method()).toBe('GET');
    expect(url.pathname).toBe('/api/vehicles/1/');
    expect(url.search).toBe('');
    return route.fulfill({ contentType: 'application/json', body });
  });
  return attempts;
}

async function capture(page: Page, name: string) {
  if (process.env.HISTORY_CAPTURE === '1')
    await page.screenshot({
      path: `test-results/vehicle-history-review/${name}.png`,
      animations: 'disabled',
      style: 'nextjs-portal { display: none; }',
    });
}

async function expectNoPagination(page: Page) {
  await expect(page.getByTestId('list-pagination')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /next page|previous page|load more/i }),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage maintenance', exact: true })).toHaveAttribute(
    'href',
    '/maintenance?vehicle=1',
  );
}

async function expectRecord(row: Locator, id: number, day: number, rowIndex: number) {
  await expect(row).toHaveAttribute('aria-rowindex', String(rowIndex));
  await expect(row.locator('td')).toHaveText([
    `Sep ${day}, 2026`,
    `Service ${id}`,
    'Alex PereiraCERT-001',
    '25.50',
    note(id),
  ]);
  await expect(row.locator('td').last()).toHaveCSS('white-space', 'pre-wrap');
  await expect(row.locator('td').last()).toHaveCSS('overflow-wrap', 'anywhere');
}

for (const count of [500, 100_000]) {
  test(`virtualizes all ${count} embedded history records with one API request`, async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    const attempts = await mockVehicle(page, historyRecords(count));
    await page.goto('/vehicles/1');
    const history = page.getByRole('table', { name: 'Vehicle maintenance history', exact: true });
    const rows = history.locator('tbody tr[data-index]');
    const scroller = page.getByTestId('maintenance-history-scroll');
    await expect(history).toHaveAttribute('aria-rowcount', String(count + 1));
    await expect(
      page.getByText(`${count} records · complete history · newest first`, { exact: true }),
    ).toBeVisible();
    await expectNoPagination(page);
    expect(attempts).toEqual(['/api/vehicles/1/']);

    const viewports =
      count === 100_000
        ? [
            { name: 'desktop', width: 1280, height: 720 },
            { name: 'mobile', width: 390, height: 844 },
          ]
        : [{ name: 'desktop', width: 1280, height: 720 }];
    for (const { name, width, height } of viewports) {
      await page.setViewportSize({ width, height });
      await page
        .getByRole('heading', { name: 'Maintenance history', exact: true })
        .evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await scroller.evaluate((element) => {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      });
      const first = rows.filter({ has: page.getByText(`Service ${count}`, { exact: true }) });
      await expectRecord(first, count, 10, 2);
      await expect.poll(() => rows.count()).toBeLessThan(100);
      await expect(rows.nth(1)).toContainText(`Service ${count - 1}`);
      if (count === 100_000) await capture(page, `${name}-history-top`);

      await scroller.focus();
      await page.keyboard.press('PageDown');
      await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      // Unknown row heights are refined while scrolling, so seek the measured end again.
      await expect
        .poll(async () => {
          await scroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          return rows.last().getAttribute('aria-rowindex');
        })
        .toBe(String(count + 1));
      await expectRecord(rows.last(), 1, 1, count + 1);
      await expect(rows.last()).toBeInViewport();
      await expect.poll(() => rows.count()).toBeLessThan(100);
      if (name === 'mobile') {
        expect(
          await scroller.evaluate((element) => element.scrollWidth > element.clientWidth),
        ).toBe(true);
        await scroller.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
        await expect(rows.last().locator('td').last()).toBeInViewport();
      }
      if (count === 100_000) await capture(page, `${name}-history-last`);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(attempts).toEqual(['/api/vehicles/1/']);
      expect(browserErrors).toEqual([]);
    }
  });
}

test('shows a complete empty history on mobile without pagination or additional API reads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const attempts = await mockVehicle(page, []);
  await page.goto('/vehicles/1');
  await expect(page.getByRole('heading', { name: 'Fleet History van', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Office', exact: true })).toHaveValue(
    'Central office · Salvador',
  );
  await expect(
    page.getByText('0 records · complete history · newest first', { exact: true }),
  ).toBeVisible();
  const empty = page.getByText('No maintenance has been recorded for this vehicle yet.', {
    exact: true,
  });
  await empty.scrollIntoViewIfNeeded();
  await expect(empty).toBeInViewport();
  await expect(
    page.getByRole('table', { name: 'Vehicle maintenance history', exact: true }),
  ).toHaveCount(0);
  await expectNoPagination(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(attempts).toEqual(['/api/vehicles/1/']);
});

test('rejects truncated JSON without automatic retries and allows a manual retry', async ({
  page,
}) => {
  await page.clock.install();
  let attempts = 0;
  let fail = true;
  await page.route('**/api/**', (route) => {
    expect(new URL(route.request().url()).pathname).toBe('/api/vehicles/1/');
    attempts += 1;
    return route.fulfill({
      contentType: 'application/json',
      body: fail ? '{"id":1,"maintenance_records":[' : JSON.stringify(vehicle),
    });
  });
  await page.goto('/vehicles/1');
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maintenance history', exact: true })).toHaveCount(
    0,
  );
  await page.clock.fastForward(35_000);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });
  await page.clock.fastForward(5_000);
  expect(attempts).toBe(1);
  fail = false;
  await alert.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('0 records · complete history · newest first')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fleet History van', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});
