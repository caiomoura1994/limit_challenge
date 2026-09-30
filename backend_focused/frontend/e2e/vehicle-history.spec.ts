import type { Page } from '@playwright/test';
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

async function mockVehicle(page: Page, records: VehicleDetail['maintenance_records']) {
  const attempts: string[] = [];
  const successful: string[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/') && response.ok()) {
      successful.push(`${url.pathname}${url.search}`);
    }
  });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    attempts.push(`${url.pathname}${url.search}`);
    expect(route.request().method()).toBe('GET');
    expect(url.pathname).toBe('/api/vehicles/1/');
    expect(url.search).toBe('');
    return route.fulfill({ json: { ...vehicle, maintenance_records: records } });
  });
  return { attempts, successful };
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

test('renders all 500 embedded history records in date and ID order without more requests when scrolling', async ({
  page,
}) => {
  // Multiplication by 137 permutes IDs 1–500; each date has 50 records to order by ID.
  const records: VehicleDetail['maintenance_records'] = Array.from({ length: 500 }, (_, index) => {
    const id = ((index * 137) % 500) + 1;
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
      maintenance_date: `2026-09-${String(((id - 1) % 10) + 1).padStart(2, '0')}`,
      maintenance_type: `Service ${id}`,
      cost: '25.50',
      notes: `Inspection note ${id}.`,
    };
  });
  const requests = await mockVehicle(page, records);
  await page.goto('/vehicles/1');
  const history = page.getByRole('table', { name: 'Vehicle maintenance history', exact: true });
  const rows = history.locator('tbody tr');
  await expect(rows).toHaveCount(500);
  await expect(
    page.getByText('500 records · complete history · newest first', { exact: true }),
  ).toBeVisible();
  const expectedIds = Array.from({ length: 10 }, (_, day) =>
    Array.from({ length: 50 }, (_, offset) => (49 - offset) * 10 + 10 - day),
  ).flat();
  const cells = await rows.evaluateAll((items) =>
    items.map((row) =>
      Array.from(row.querySelectorAll('td'), (cell) => cell.innerText.trim().replace(/\s+/g, ' ')),
    ),
  );
  expect(cells).toEqual(
    expectedIds.map((id) => [
      `Sep ${((id - 1) % 10) + 1}, 2026`,
      `Service ${id}`,
      'Alex Pereira CERT-001',
      '$25.50',
      `Inspection note ${id}.`,
    ]),
  );
  await expectNoPagination(page);
  expect(requests.successful).toEqual(['/api/vehicles/1/']);
  // Dev StrictMode can abort an initial mount; scrolling must not add even an aborted request.
  const initialAttempts = requests.attempts.length;

  const heading = page.getByRole('heading', { name: 'Maintenance history', exact: true });
  for (const [name, width, height] of [
    ['desktop', 1280, 720],
    ['mobile', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await heading.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(rows.first()).toBeInViewport();
    await capture(page, `${name}-history-top`);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows.last()).toBeInViewport();
    await expect(rows.last()).toContainText('Inspection note 1.');
    await capture(page, `${name}-history-last`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(requests.successful).toEqual(['/api/vehicles/1/']);
    expect(requests.attempts).toHaveLength(initialAttempts);
  }
});

test('shows a complete empty history on mobile without pagination or additional API reads', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = await mockVehicle(page, []);
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
  expect(requests.successful).toEqual(['/api/vehicles/1/']);
  const initialAttempts = requests.attempts.length;
  await empty.scrollIntoViewIfNeeded();
  await expect(empty).toBeInViewport();
  await expect(
    page.getByRole('table', { name: 'Vehicle maintenance history', exact: true }),
  ).toHaveCount(0);
  await expectNoPagination(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(requests.successful).toEqual(['/api/vehicles/1/']);
  expect(requests.attempts).toHaveLength(initialAttempts);
});
