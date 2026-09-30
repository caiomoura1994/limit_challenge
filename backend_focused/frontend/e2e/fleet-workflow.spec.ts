import type { Locator, Page } from '@playwright/test';
import { apiURL, expect, test } from './fixtures';
import type { Office, VehicleInput } from '../lib/api/types';

async function selectOption(page: Page, scope: Locator, label: string, option: string) {
  await scope.getByRole('combobox', { name: label }).fill(option.split(' · ')[0]);
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function fillVehicle(page: Page, dialog: Locator, input: VehicleInput, office: Office) {
  await dialog.getByRole('textbox', { name: 'Make', exact: true }).fill(input.make);
  await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill(input.model);
  await dialog.getByRole('spinbutton', { name: 'Year' }).fill(String(input.year));
  await dialog.getByRole('textbox', { name: 'License plate' }).fill(input.license_plate);
  await dialog.getByRole('textbox', { name: 'VIN' }).fill(input.vin);
  await selectOption(page, dialog, 'Office', `${office.name} · ${office.city}`);
}

test('manages offices, mechanics, vehicles and maintenance against the real API', async ({
  page,
  request,
  records,
}, testInfo) => {
  // Ensure the office chosen in the vehicle form is beyond the API's first page.
  const officeCount = await records.count('offices');
  for (let index = officeCount; index < 10; index += 1) {
    await records.create('offices', {
      name: `E2E padding ${records.suffix}-${index}`,
      city: 'Test city',
    });
  }

  await page.goto('/offices');
  await page.getByRole('button', { name: 'Add office', exact: true }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Add office' });
  await dialog.getByRole('textbox', { name: 'Office name' }).fill(`E2E Office ${records.suffix}`);
  await dialog.getByRole('textbox', { name: 'City' }).fill('Salvador');
  const office = await records.createInUI(page, 'offices', () =>
    dialog.getByRole('button', { name: 'Create office' }).click(),
  );
  await expect(dialog).toBeHidden();
  await page.goto(`/offices?page=${Math.ceil((await records.count('offices')) / 10)}`);
  await page.getByRole('button', { name: `Edit ${office.name}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit office' });
  await dialog.getByRole('textbox', { name: 'City' }).fill('Recife');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  office.city = 'Recife';
  const destination = await records.create('offices', {
    name: `E2E Destination ${records.suffix}`,
    city: 'São Paulo',
  });

  await page.goto('/mechanics');
  await page.getByRole('button', { name: 'Add mechanic', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: 'Add mechanic' });
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill(`E2E Mechanic ${records.suffix}`);
  await dialog
    .getByRole('textbox', { name: 'Certification number' })
    .fill(`CERT-${records.suffix}`);
  const mechanic = await records.createInUI(page, 'mechanics', () =>
    dialog.getByRole('button', { name: 'Create mechanic' }).click(),
  );
  await expect(dialog).toBeHidden();
  await page.goto(`/mechanics?page=${Math.ceil((await records.count('mechanics')) / 10)}`);
  await page.getByRole('button', { name: `Edit ${mechanic.name}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit mechanic' });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(`${mechanic.name} updated`);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  mechanic.name += ' updated';

  const vehicleInput: VehicleInput = {
    make: `E2E-${records.suffix}`,
    model: 'Fleet test',
    year: 2026,
    vin: `E2E${records.suffix}`,
    license_plate: `T-${records.suffix}`,
    office: office.id,
  };
  await page.goto('/vehicles');
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Add vehicle' });
  await fillVehicle(page, dialog, vehicleInput, office);
  const vehicle = await records.createInUI(page, 'vehicles', () =>
    dialog.getByRole('button', { name: 'Create vehicle' }).click(),
  );
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(`/vehicles/${vehicle.id}`);
  await page.goto('/vehicles');
  await page.getByRole('textbox', { name: 'Make', exact: true }).fill(vehicle.make);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const vehicleRow = page.getByRole('row').filter({ hasText: vehicle.license_plate });
  await expect(vehicleRow).toContainText(office.name);
  await vehicleRow.getByRole('link', { name: `${vehicle.make} ${vehicle.model}` }).click();
  await expect(page).toHaveURL(`/vehicles/${vehicle.id}`);
  await page.getByRole('button', { name: 'Edit vehicle', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit vehicle' });
  await dialog.getByRole('textbox', { name: 'Model', exact: true }).fill('Updated model');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: `${vehicle.make} Updated model` })).toBeVisible();
  await selectOption(
    page,
    page.locator('main'),
    'Office',
    `${destination.name} · ${destination.city}`,
  );
  await page.getByRole('button', { name: 'Update assignment' }).click();
  await expect(
    page.getByText(`Currently at ${destination.name} in ${destination.city}.`),
  ).toBeVisible();

  await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Add maintenance', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: 'Add maintenance record' });
  await selectOption(
    page,
    dialog,
    'Vehicle',
    `${vehicle.license_plate} · ${vehicle.make} Updated model`,
  );
  await selectOption(
    page,
    dialog,
    'Mechanic',
    `${mechanic.name} · ${mechanic.certification_number}`,
  );
  await dialog.getByLabel('Maintenance date').fill('2026-09-29');
  await expect(dialog.getByText('$', { exact: true })).toBeVisible();
  await dialog.getByLabel('Cost').fill('123.45');
  await dialog.getByLabel('Maintenance type').fill(`E2E service ${records.suffix}`);
  await dialog.getByLabel('Notes').fill('Created by the end-to-end test.');
  const maintenance = await records.createInUI(page, 'maintenance-records', () =>
    dialog.getByRole('button', { name: 'Create record' }).click(),
  );
  await expect(dialog).toBeHidden();
  await page.goto(
    `/maintenance?page=${Math.ceil((await records.count('maintenance-records')) / 10)}`,
  );
  await expect(page.getByRole('table', { name: 'Maintenance records' })).toContainText(
    maintenance.maintenance_type,
  );
  await page.goto(`/vehicles/${vehicle.id}`);
  await expect(page.getByRole('table', { name: 'Vehicle maintenance history' })).toContainText(
    mechanic.certification_number,
  );
  await expect(page.getByRole('table', { name: 'Vehicle maintenance history' })).toContainText(
    '$123.45',
  );
  await page.screenshot({
    path: testInfo.outputPath('vehicle-detail-desktop.png'),
    fullPage: true,
    style: 'nextjs-portal { display: none; }',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('vehicle-detail-mobile.png'),
    fullPage: true,
    style: 'nextjs-portal { display: none; }',
  });
  await page.setViewportSize({ width: 1280, height: 720 });

  const filters = new URLSearchParams({
    office: String(destination.id),
    active: 'true',
    make: vehicle.make,
    model: 'Updated model',
    maintenance_date_after: '2026-09-01',
    maintenance_date_before: '2026-09-30',
    mechanic_certification_number: mechanic.certification_number,
  });
  await page.goto(`/vehicles?${filters}`);
  await expect(page.getByText('1 vehicles found')).toBeVisible();
  await page.getByRole('button', { name: `Delete ${vehicle.license_plate}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Delete vehicle?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('related records depend on it');
  expect((await request.get(`${apiURL}/vehicles/${vehicle.id}/`)).ok()).toBeTruthy();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.goto(
    `/maintenance?page=${Math.ceil((await records.count('maintenance-records')) / 10)}`,
  );
  const maintenanceRow = page.getByRole('row').filter({ hasText: maintenance.maintenance_type });
  await maintenanceRow.getByRole('button', { name: /Edit/ }).click();
  dialog = page.getByRole('dialog', { name: 'Edit maintenance record' });
  await dialog.getByLabel('Notes').fill('Updated by the end-to-end test.');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await maintenanceRow.getByRole('button', { name: /Delete/ }).click();
  dialog = page.getByRole('dialog', { name: 'Delete maintenance record?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await request.get(`${apiURL}/maintenance-records/${maintenance.id}/`)).status()).toBe(
    404,
  );

  await page.goto(`/vehicles?make=${encodeURIComponent(vehicle.make)}`);
  await page.getByRole('button', { name: `Delete ${vehicle.license_plate}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Delete vehicle?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('0 vehicles found')).toBeVisible();

  await page.goto(`/mechanics?page=${Math.ceil((await records.count('mechanics')) / 10)}`);
  await page.getByRole('button', { name: `Delete ${mechanic.name}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Delete mechanic?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/offices?page=${Math.ceil((await records.count('offices')) / 10)}`);
  await page.getByRole('button', { name: `Delete ${destination.name}`, exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Delete office?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('displays API validation beside the duplicate VIN field', async ({ page, records }) => {
  const office = await records.create('offices', {
    name: `E2E duplicate ${records.suffix}`,
    city: 'Salvador',
  });
  const input: VehicleInput = {
    make: 'Duplicate test',
    model: 'Original',
    year: 2026,
    vin: `E2E${records.suffix}`,
    license_plate: `A-${records.suffix}`,
    office: office.id,
  };
  await records.create('vehicles', input);
  await page.goto('/vehicles');
  await page.getByRole('button', { name: 'Add vehicle', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add vehicle' });
  await fillVehicle(page, dialog, { ...input, license_plate: `B-${records.suffix}` }, office);
  await dialog.getByRole('button', { name: 'Create vehicle' }).click();
  await expect(dialog.getByText('A vehicle with this VIN already exists.')).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'VIN' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
