import { expect, test } from './fixtures';

const office = {
  id: 42,
  name: 'Test office',
  city: 'Salvador',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const emptyPage = { count: 0, next: null, previous: null, results: [] };

test('combines filters in the URL and restores them on reload and back navigation', async ({
  page,
}) => {
  const requestedQueries: URLSearchParams[] = [];
  await page.route('**/api/offices/?*', (route) =>
    route.fulfill({ json: { ...emptyPage, count: 1, results: [office] } }),
  );
  await page.route(`**/api/offices/${office.id}/`, (route) => route.fulfill({ json: office }));
  await page.route('**/api/vehicles/?*', (route) => {
    requestedQueries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: emptyPage });
  });
  await page.goto('/vehicles?page=3');
  await page.getByRole('combobox', { name: 'Office' }).fill(office.name);
  await page.getByRole('option', { name: `${office.name} · ${office.city}`, exact: true }).click();
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Inactive', exact: true }).click();
  await page.getByRole('textbox', { name: 'Make', exact: true }).fill('Toyota');
  await page.getByRole('textbox', { name: 'Model', exact: true }).fill('Corolla');
  await page.getByLabel('Maintained from').fill('2026-01-01');
  await page.getByLabel('Maintained through').fill('2026-09-29');
  await page.getByLabel('Mechanic certification number').fill('CERT-123');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const expected = {
    office: '42',
    active: 'false',
    make: 'Toyota',
    model: 'Corolla',
    maintenance_date_after: '2026-01-01',
    maintenance_date_before: '2026-09-29',
    mechanic_certification_number: 'CERT-123',
  };
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(expected);
  await expect.poll(() => requestedQueries.at(-1)?.get('active')).toBe('false');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Make', exact: true })).toHaveValue('Toyota');
  await expect(page.getByRole('combobox', { name: 'Office' })).toHaveValue(
    `${office.name} · ${office.city}`,
  );
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveText('Inactive');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL('/vehicles');
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Make', exact: true })).toHaveValue('Toyota');
});

test('shows loading, network failure, retry and an empty result', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route('**/api/offices/?*', (route) => route.fulfill({ json: emptyPage }));
  await page.route('**/api/vehicles/?*', async (route) => {
    await gate;
    if (fail) await route.abort('failed');
    else await route.fulfill({ json: emptyPage });
  });
  await page.goto('/vehicles');
  await expect(page.getByRole('progressbar', { name: 'Loading records' })).toBeVisible();
  release();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Could not reach the API');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'No vehicles match these filters',
  );
  await expect(page.getByText('0 vehicles found')).toBeVisible();
});

test('keeps the mobile layout usable and validates required form fields', async ({ page }) => {
  await page.route('**/api/offices/?*', (route) => route.fulfill({ json: emptyPage }));
  await page.route('**/api/offices/summary/', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/vehicles/?*', (route) => route.fulfill({ json: emptyPage }));
  await page.goto('/vehicles');
  await expect(page.getByText('0 vehicles found')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Vehicles', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('combobox', { name: /^Section\b/ }).click();
  await page.getByRole('option', { name: 'Offices', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Offices', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add office', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add office' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Create office' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Office name' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(dialog.getByRole('textbox', { name: 'City' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(dialog.getByText('This field is required.')).toHaveCount(2);
  await dialog.getByRole('textbox', { name: 'Office name' }).fill('   ');
  await dialog.getByRole('textbox', { name: 'City' }).fill('Salvador');
  await dialog.getByRole('button', { name: 'Create office' }).click();
  await expect(dialog.getByText('Enter an office name.')).toBeVisible();
});

test('rejects negative costs and future maintenance dates before submitting', async ({ page }) => {
  let maintenanceCreates = 0;
  await page.route('**/api/maintenance-records/**', (route) => {
    if (route.request().method() === 'POST') {
      maintenanceCreates += 1;
      return route.continue();
    }
    return route.fulfill({ json: emptyPage });
  });
  await page.route('**/api/vehicles/**', (route) => route.fulfill({ json: emptyPage }));
  await page.route('**/api/mechanics/**', (route) => route.fulfill({ json: emptyPage }));

  await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Add maintenance', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add maintenance record' });
  await dialog.getByLabel('Maintenance date').fill('2999-01-01');
  await dialog.getByRole('textbox', { name: 'Cost' }).fill('-0.01');
  await dialog.getByRole('textbox', { name: 'Maintenance type' }).fill('Inspection');
  await dialog.getByRole('button', { name: 'Create record' }).click();

  await expect(dialog.getByText('Maintenance date cannot be in the future.')).toBeVisible();
  await expect(
    dialog.getByText('Enter zero or a positive cost with up to 10 whole digits and 2 decimals.'),
  ).toBeVisible();
  expect(maintenanceCreates).toBe(0);
});
