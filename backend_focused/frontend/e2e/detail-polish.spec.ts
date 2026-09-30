import type { Locator, Page } from '@playwright/test';
import type { MaintenanceRecord, Mechanic, Office, Vehicle } from '../lib/api/types';
import { apiURL, expect, test } from './fixtures';

const timestamps = { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const mechanic: Mechanic = {
  ...timestamps,
  id: 2,
  name: 'Alex Pereira',
  certification_number: 'CERT-001',
  active: true,
};
const vehicle: Vehicle = {
  ...timestamps,
  id: 3,
  vin: 'TEST000001',
  license_plate: 'TEST-001',
  make: 'Fleet',
  model: 'Van',
  year: 2026,
  office: 1,
  active: true,
};
const maintenance: MaintenanceRecord = {
  ...timestamps,
  id: 4,
  vehicle: vehicle.id,
  mechanic: mechanic.id,
  maintenance_type: 'Oil change',
  maintenance_date: '2026-09-01',
  cost: '50.00',
  notes: 'Routine service.',
};

async function mockRecords(page: Page, firstOfficeName = 'Office 1') {
  const offices: Office[] = Array.from({ length: 11 }, (_, index) => ({
    ...timestamps,
    id: index + 1,
    name: index === 0 ? firstOfficeName : `Office ${index + 1}`,
    city: 'Salvador',
  }));
  await page.route('**/api/**', (route) => {
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());
    const detail = [...offices, mechanic, vehicle].find((record) => {
      const resource =
        'city' in record ? 'offices' : 'certification_number' in record ? 'mechanics' : 'vehicles';
      return url.pathname === `/api/${resource}/${record.id}/`;
    });
    if (detail) return route.fulfill({ json: detail });
    const records =
      url.pathname === '/api/offices/'
        ? offices
        : url.pathname === '/api/mechanics/'
          ? [mechanic]
          : url.pathname === '/api/vehicles/'
            ? [vehicle]
            : [maintenance];
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    return route.fulfill({
      json: {
        count: records.length,
        next:
          records.length > pageNumber * 10
            ? `${apiURL}${url.pathname.replace('/api', '')}?page=${pageNumber + 1}`
            : null,
        previous:
          pageNumber > 1
            ? `${apiURL}${url.pathname.replace('/api', '')}?page=${pageNumber - 1}`
            : null,
        results: records.slice((pageNumber - 1) * 10, pageNumber * 10),
      },
    });
  });
}

async function expectDetail(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(dialog.locator('..')).toHaveCSS('opacity', '1');
  const mascot = dialog.getByTestId('fleet-mascot');
  await expect(mascot).toHaveAttribute('aria-hidden', 'true');
  await expect(mascot.locator('img')).toHaveAttribute('alt', '');
  await expect
    .poll(() =>
      mascot
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  return dialog;
}

async function capture(page: Page, name: string) {
  if (process.env.DETAIL_CAPTURE === '1')
    await page.screenshot({
      path: `test-results/detail-review/${name}.png`,
      fullPage: true,
      animations: 'disabled',
      style: 'nextjs-portal { display: none; }',
    });
}

async function expectInset(pagination: Locator, count: string) {
  await expect(pagination).toHaveCSS('padding-left', '16px');
  await expect(pagination).toHaveCSS('padding-right', '16px');
  const wrapper = await pagination.boundingBox();
  const label = await pagination.getByText(count, { exact: true }).boundingBox();
  expect(label!.x - wrapper!.x).toBeGreaterThanOrEqual(16);
}

test('keeps pagination inset and details decorated while preserving paging and edit flows', async ({
  page,
}) => {
  await mockRecords(page);
  await page.goto('/offices');
  const pagination = page.getByTestId('list-pagination');
  await expect(pagination.getByText('1–10 of 11', { exact: true })).toBeVisible();
  await expectInset(pagination, '1–10 of 11');
  const card = await pagination.locator('..').boundingBox();
  const count = await pagination.getByText('1–10 of 11', { exact: true }).boundingBox();
  expect(count!.x - card!.x).toBeGreaterThanOrEqual(16);
  await capture(page, 'desktop-pagination');
  await pagination.getByRole('button', { name: 'Go to next page', exact: true }).click();
  await expect(page).toHaveURL('/offices?page=2');
  await expect(pagination.getByText('11–11 of 11', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Offices', exact: true })).toContainText(
    'Office 11',
  );
  await pagination.getByRole('button', { name: 'Go to previous page', exact: true }).click();
  await expect(pagination.getByText('1–10 of 11', { exact: true })).toBeVisible();

  for (const record of [
    {
      path: '/offices',
      table: 'Offices',
      view: 'View Office 1',
      title: 'Office 1',
      edit: 'Edit office',
      editTitle: 'Edit office',
      field: 'Office name',
      value: 'Office 1',
    },
    {
      path: '/mechanics',
      table: 'Mechanics',
      view: `View ${mechanic.name}`,
      title: mechanic.name,
      edit: 'Edit mechanic',
      editTitle: 'Edit mechanic',
      field: 'Name',
      value: mechanic.name,
    },
    {
      path: '/maintenance',
      table: 'Maintenance records',
      view: 'View',
      title: maintenance.maintenance_type,
      edit: 'Edit record',
      editTitle: 'Edit maintenance record',
      field: 'Maintenance type',
      value: maintenance.maintenance_type,
    },
  ]) {
    await page.goto(record.path);
    const view = page
      .getByRole('table', { name: record.table, exact: true })
      .getByRole('button', { name: record.view, exact: true });
    await view.click();
    let dialog = await expectDetail(page, record.title);
    if (record.path === '/offices') await capture(page, 'desktop-office-detail');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await view.click();
    dialog = await expectDetail(page, record.title);
    await dialog.getByRole('button', { name: record.edit, exact: true }).click();
    const edit = page.getByRole('dialog', { name: record.editTitle, exact: true });
    await expect(edit.getByRole('textbox', { name: record.field, exact: true })).toHaveValue(
      record.value,
    );
    if (record.path === '/maintenance') {
      await expect(edit.getByText('$', { exact: true })).toBeVisible();
    }
    await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(edit).toBeHidden();
  }
});

test('wraps a long mobile detail title without hiding its mascot or overflowing', async ({
  page,
}) => {
  const name = 'OfficeWithAnUnbrokenNameThatMustWrapWithoutPushingTheMascotBeyondTheDialogBoundary';
  await page.setViewportSize({ width: 390, height: 844 });
  await mockRecords(page, name);
  await page.goto('/offices');
  await page.getByRole('button', { name: `View ${name}`, exact: true }).click();
  const dialog = await expectDetail(page, name);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await capture(page, 'mobile-office-detail');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expectInset(page.getByTestId('list-pagination'), '1–10 of 11');
});
