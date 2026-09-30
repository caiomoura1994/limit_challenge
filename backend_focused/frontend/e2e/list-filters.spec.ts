import type { Page } from '@playwright/test';
import type { MaintenancePage } from '../lib/api/types';
import { apiURL, expect, test } from './fixtures';

async function selectOption(page: Page, label: string, option: string) {
  const input = page.getByRole('combobox', { name: label, exact: true });
  if (label === 'Status') await input.click();
  else await input.fill(option.split(' · ')[0]);
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function applyFilters(page: Page, resource: string, expected: Record<string, string>) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      `${url.origin}${url.pathname}` === `${apiURL}/${resource}/` &&
      Object.entries(expected).every(([key, value]) => url.searchParams.get(key) === value) &&
      (!url.searchParams.has('page') || url.searchParams.get('page') === '1')
    );
  });
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(expected);
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  const result = (await response.json()) as { count: number; results: { id: number }[] };
  return result;
}

test('filters all maintenance records by search, vehicle, mechanic and inclusive dates', async ({
  page,
  request,
  records,
}) => {
  const office = await records.create('offices', {
    name: `Service branch ${records.suffix}`,
    city: 'Salvador',
  });
  const mechanic = await records.create('mechanics', {
    name: `Service technician ${records.suffix}`,
    certification_number: `CERT-${records.suffix}`,
  });
  const otherMechanic = await records.create('mechanics', {
    name: `Other technician ${records.suffix}`,
    certification_number: `OTHER-${records.suffix}`,
  });
  const vehicle = await records.create('vehicles', {
    make: 'Fleet',
    model: 'Primary',
    year: 2026,
    vin: `P-${records.suffix}`,
    license_plate: `P-${records.suffix}`,
    office: office.id,
  });
  const otherVehicle = await records.create('vehicles', {
    make: 'Fleet',
    model: 'Other',
    year: 2026,
    vin: `O-${records.suffix}`,
    license_plate: `O-${records.suffix}`,
    office: office.id,
  });
  const input = { vehicle: vehicle.id, mechanic: mechanic.id, cost: '50.00' };
  // Matching records must live beyond the unfiltered first page, so client-only filtering fails.
  for (let index = await records.count('maintenance-records'); index < 10; index += 1) {
    await records.create('maintenance-records', {
      ...input,
      maintenance_date: '2026-01-01',
      maintenance_type: `Padding ${records.suffix}-${index}`,
    });
  }
  const notes = `filter-${records.suffix}`;
  const start = await records.create('maintenance-records', {
    ...input,
    notes,
    maintenance_date: '2025-09-01',
    maintenance_type: `Boundary start ${records.suffix}`,
  });
  const end = await records.create('maintenance-records', {
    ...input,
    notes,
    maintenance_date: '2025-09-30',
    maintenance_type: `Boundary end ${records.suffix}`,
  });
  const excluded = [
    { maintenance_date: '2025-08-31', maintenance_type: 'Before range' },
    { maintenance_date: '2025-10-01', maintenance_type: 'After range' },
    { maintenance_date: '2025-09-15', maintenance_type: 'Other vehicle', vehicle: otherVehicle.id },
    {
      maintenance_date: '2025-09-15',
      maintenance_type: 'Other mechanic',
      mechanic: otherMechanic.id,
    },
    {
      maintenance_date: '2025-09-15',
      maintenance_type: 'Different notes',
      notes: 'Unrelated work',
    },
  ];
  for (const record of excluded) {
    await records.create('maintenance-records', { ...input, notes, ...record });
  }
  const firstPageResponse = await request.get(`${apiURL}/maintenance-records/`);
  const firstPage = (await firstPageResponse.json()) as MaintenancePage;
  expect(firstPage.results?.map((record) => record.id)).not.toContain(start.id);
  expect(firstPage.results?.map((record) => record.id)).not.toContain(end.id);

  await page.goto('/maintenance?page=2');
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(` ${notes.toUpperCase()} `);
  await selectOption(
    page,
    'Vehicle',
    `${vehicle.license_plate} · ${vehicle.make} ${vehicle.model}`,
  );
  await selectOption(page, 'Mechanic', `${mechanic.name} · ${mechanic.certification_number}`);
  await page.getByLabel('Maintained from', { exact: true }).fill('2025-09-30');
  await page.getByLabel('Maintained through', { exact: true }).fill('2025-09-01');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByLabel('Maintained through', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page).toHaveURL('/maintenance?page=2');
  await page.getByLabel('Maintained from', { exact: true }).fill('2025-09-01');
  await page.getByLabel('Maintained through', { exact: true }).fill('2025-09-30');
  const expected = {
    search: notes.toUpperCase(),
    vehicle: String(vehicle.id),
    mechanic: String(mechanic.id),
    maintenance_date_after: '2025-09-01',
    maintenance_date_before: '2025-09-30',
  };
  const result = await applyFilters(page, 'maintenance-records', expected);
  expect(result.count).toBe(2);
  expect(result.results.map((record) => record.id)).toEqual([start.id, end.id]);
  const table = page.getByRole('table', { name: 'Maintenance records', exact: true });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table).toContainText(start.maintenance_type);
  await expect(table).toContainText(end.maintenance_type);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue(
    expected.search,
  );
  await expect(page.getByLabel('Maintained from', { exact: true })).toHaveValue('2025-09-01');
  await expect(table.getByRole('row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page).toHaveURL('/maintenance');
  await expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveValue('');
  await expect(page.getByLabel('Maintained through', { exact: true })).toHaveValue('');
  await page.goBack();
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(expected);
  await expect(page.getByRole('combobox', { name: /^Mechanic\b/ })).toHaveValue(
    `${mechanic.name} · ${mechanic.certification_number}`,
  );
  await expect(table.getByRole('row')).toHaveCount(3);
});

test('searches offices by city, combines mechanic search with status and searches vehicle plates', async ({
  page,
  records,
}) => {
  for (let index = await records.count('offices'); index < 10; index += 1) {
    await records.create('offices', {
      name: `Padding ${records.suffix}-${index}`,
      city: 'Test city',
    });
  }
  const office = await records.create('offices', {
    name: `Branch ${records.suffix}`,
    city: `City-${records.suffix}`,
  });
  for (let index = await records.count('mechanics'); index < 10; index += 1) {
    await records.create('mechanics', {
      name: `Padding ${records.suffix}-${index}`,
      certification_number: `PAD-${records.suffix}-${index}`,
    });
  }
  const active = await records.create('mechanics', {
    name: `Active technician ${records.suffix}`,
    certification_number: `CERT-${records.suffix}-active`,
    active: true,
  });
  const inactive = await records.create('mechanics', {
    name: `Inactive technician ${records.suffix}`,
    certification_number: `CERT-${records.suffix}-inactive`,
    active: false,
  });
  const vehicle = await records.create('vehicles', {
    make: 'Searchable fleet',
    model: 'Van',
    year: 2026,
    vin: `E2E-${records.suffix}`,
    license_plate: `PLATE-${records.suffix}`,
    office: office.id,
  });

  await page.goto('/offices?page=2');
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(office.city.toUpperCase());
  const offices = await applyFilters(page, 'offices', { search: office.city.toUpperCase() });
  expect(offices.results.map((record) => record.id)).toEqual([office.id]);
  await expect(page.getByRole('table', { name: 'Offices', exact: true })).toContainText(
    office.name,
  );

  await page.goto('/mechanics?page=2');
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(`CERT-${records.suffix}`);
  await selectOption(page, 'Status', 'Inactive');
  const mechanics = await applyFilters(page, 'mechanics', {
    search: `CERT-${records.suffix}`,
    active: 'false',
  });
  expect(mechanics.results.map((record) => record.id)).toEqual([inactive.id]);
  const mechanicsTable = page.getByRole('table', { name: 'Mechanics', exact: true });
  await expect(mechanicsTable).toContainText(inactive.name);
  await expect(mechanicsTable).not.toContainText(active.certification_number);

  await page.goto('/vehicles');
  await page
    .getByRole('textbox', { name: 'Search', exact: true })
    .fill(vehicle.license_plate.toLowerCase());
  const vehicles = await applyFilters(page, 'vehicles', {
    search: vehicle.license_plate.toLowerCase(),
  });
  expect(vehicles.results.map((record) => record.id)).toEqual([vehicle.id]);
  await expect(page.getByRole('row').filter({ hasText: vehicle.license_plate })).toBeVisible();
});
