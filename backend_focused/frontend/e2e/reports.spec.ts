import type { Page } from '@playwright/test';
import type { MechanicWorkload, OfficeSummary } from '../lib/api/types';
import { expect, test } from './fixtures';

const emptyPage = { count: 0, next: null, previous: null, results: [] };
const offices: OfficeSummary[] = [
  {
    name: 'Central office',
    city: 'Salvador',
    active_vehicle_count: 8,
    maintenance_cost_last_year: '1200.50',
    last_maintenance: '2026-09-01',
  },
  {
    name: 'Central office',
    city: 'Recife',
    active_vehicle_count: 0,
    maintenance_cost_last_year: '0.00',
    last_maintenance: null,
  },
  {
    name: 'Regional office',
    city: 'Feira de Santana',
    active_vehicle_count: 3,
    maintenance_cost_last_year: '430.25',
    last_maintenance: '2026-08-31',
  },
];
const mechanics: MechanicWorkload[] = [
  { name: 'Alex Pereira', maintenance_count: 7, total_maintenance_cost: '900.25' },
  { name: 'Alex Pereira', maintenance_count: 0, total_maintenance_cost: '-15.50' },
  { name: 'Beatriz Santos', maintenance_count: 3, total_maintenance_cost: '800.75' },
];

async function mockReports(page: Page, requested: string[] = []) {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/summary/') || pathname.endsWith('/workload/')) requested.push(pathname);
    return route.fulfill({
      json: pathname.endsWith('/summary/')
        ? offices
        : pathname.endsWith('/workload/')
          ? mechanics
          : emptyPage,
    });
  });
}

async function capture(page: Page, name: string) {
  if (process.env.REPORT_CAPTURE === '1') {
    await page.screenshot({
      path: `test-results/reports-review/${name}.png`,
      fullPage: true,
      animations: 'disabled',
      style: 'nextjs-portal { display: none; }',
    });
  }
}

async function expectSelectedTab(page: Page, selected: string, parent: string) {
  const navigation = page.getByRole('tablist', { name: 'Main navigation', exact: true });
  if (await navigation.isVisible()) {
    const section = navigation.getByRole('tab', { name: parent, exact: true });
    await expect(section).toHaveAttribute('aria-selected', 'true');
    await expect(section).toHaveAttribute('aria-current', 'location');
  } else {
    await expect(page.getByRole('combobox', { name: /^Section\b/ })).toHaveText(parent);
  }
  const views = page.getByRole('tablist', { name: `${parent} views`, exact: true });
  const selectedView = selected === 'Mechanic workload' ? 'Workload' : selected;
  await expect(views.getByRole('tab', { name: selectedView, exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(views.getByRole('tab', { name: selectedView, exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(
    views.getByRole('tab', { name: `All ${parent.toLowerCase()}`, exact: true }),
  ).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('heading', { name: parent, exact: true })).toBeVisible();
}

async function showChart(page: Page, metric: string) {
  await page
    .getByRole('group', { name: 'Report view', exact: true })
    .getByRole('button', { name: 'Chart', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Chart metric', exact: true })
    .getByRole('button', { name: metric, exact: true })
    .click();
  const chart = page.getByRole('region', { name: `${metric} chart`, exact: true });
  await expect(chart.locator('svg.MuiChartsSvgLayer-root')).toBeVisible();
  return chart;
}

async function expectChartValues(
  page: Page,
  metric: string,
  rows: { label: string; value: string }[],
) {
  const chart = await showChart(page, metric);
  await expect(chart.locator('.MuiBarChart-element')).toHaveCount(rows.length);
  await chart.locator('[tabindex="0"]').first().focus();
  // A metric change may retain the focused record; return to the first one before reading each value.
  for (let index = 0; index < rows.length; index += 1) await page.keyboard.press('ArrowLeft');
  for (let index = 0; index < rows.length; index += 1) {
    await expect(chart.getByRole('img')).toHaveAccessibleName(
      `${rows[index].label}; ${metric}; ${rows[index].value}`,
    );
    if (index < rows.length - 1) await page.keyboard.press('ArrowRight');
  }
  await page.getByRole('heading', { name: metric, exact: true }).click();
  await page.mouse.move(0, 0);
}

async function showList(page: Page) {
  await page
    .getByRole('group', { name: 'Report view', exact: true })
    .getByRole('button', { name: 'List', exact: true })
    .click();
}

test('opens dedicated report tabs and preserves every row when switching between list and chart metrics', async ({
  page,
}) => {
  const requested: string[] = [];
  await mockReports(page, requested);
  await page.goto('/offices');
  await expect(page.getByRole('heading', { name: 'Offices', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Office fleet summary', exact: true })).toHaveCount(
    0,
  );
  expect(requested).toEqual([]);
  await page.getByRole('tab', { name: 'Fleet summary', exact: true }).click();
  await expect(page).toHaveURL('/offices/summary');
  await expectSelectedTab(page, 'Fleet summary', 'Offices');
  const officeTable = page.getByRole('table', { name: 'Office fleet summary', exact: true });
  const officeRows = officeTable.getByRole('row');
  await expect(officeRows).toHaveCount(4);
  await expect(officeRows.nth(1).getByRole('cell')).toHaveText([
    'Central office',
    'Salvador',
    '8',
    '$1,200.50',
    'Sep 1, 2026',
  ]);
  await expect(officeRows.nth(2).getByRole('cell')).toHaveText([
    'Central office',
    'Recife',
    '0',
    '$0.00',
    'Never',
  ]);
  await expect(officeRows.nth(3).getByRole('cell')).toHaveText([
    'Regional office',
    'Feira de Santana',
    '3',
    '$430.25',
    'Aug 31, 2026',
  ]);
  await expect(
    page
      .getByRole('group', { name: 'Report view', exact: true })
      .getByRole('button', { name: 'List', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');

  await expectChartValues(
    page,
    'Active vehicles',
    offices.map((office) => ({
      label: `${office.name} · ${office.city}`,
      value: String(office.active_vehicle_count),
    })),
  );
  await expect(officeTable).toHaveCount(0);
  await capture(page, 'desktop-fleet-summary');
  await expectChartValues(page, 'Maintenance cost', [
    { label: 'Central office · Salvador', value: '$1,200.50' },
    { label: 'Central office · Recife', value: '$0.00' },
    { label: 'Regional office · Feira de Santana', value: '$430.25' },
  ]);
  await showList(page);
  await expect(officeRows).toHaveCount(4);
  await page.reload();
  await expectSelectedTab(page, 'Fleet summary', 'Offices');
  await expect(officeRows).toHaveCount(4);
  await page.goto('/mechanics');
  await expect(page.getByRole('heading', { name: 'Mechanics', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Mechanic workload', exact: true })).toHaveCount(0);
  expect(requested.filter((pathname) => pathname.endsWith('/workload/'))).toEqual([]);
  await page.getByRole('tab', { name: 'Workload', exact: true }).click();
  await expect(page).toHaveURL('/mechanics/workload');
  await expectSelectedTab(page, 'Mechanic workload', 'Mechanics');
  const mechanicRows = page
    .getByRole('table', { name: 'Mechanic workload', exact: true })
    .getByRole('row');
  await expect(mechanicRows).toHaveCount(4);
  await expect(mechanicRows.nth(1).getByRole('cell')).toHaveText(['Alex Pereira', '7', '$900.25']);
  await expect(mechanicRows.nth(2).getByRole('cell')).toHaveText(['Alex Pereira', '0', '-$15.50']);
  await expect(mechanicRows.nth(3).getByRole('cell')).toHaveText([
    'Beatriz Santos',
    '3',
    '$800.75',
  ]);
  await expectChartValues(
    page,
    'Maintenance records',
    mechanics.map((mechanic) => ({
      label: mechanic.name,
      value: String(mechanic.maintenance_count),
    })),
  );
  await capture(page, 'desktop-mechanic-workload');
  await expectChartValues(page, 'Total cost', [
    { label: 'Alex Pereira', value: '$900.25' },
    { label: 'Alex Pereira', value: '-$15.50' },
    { label: 'Beatriz Santos', value: '$800.75' },
  ]);
  const costBars = page.getByTestId('report-chart').locator('.MuiBarChart-element');
  const negative = await costBars.nth(1).boundingBox();
  const positive = await costBars.nth(0).boundingBox();
  expect(negative?.width).toBeGreaterThan(0);
  expect(negative!.x + negative!.width).toBeCloseTo(positive!.x, 1);
  await showList(page);
  await expect(mechanicRows).toHaveCount(4);
  await page.reload();
  await expectSelectedTab(page, 'Mechanic workload', 'Mechanics');
});

for (const report of [
  {
    path: '/offices/summary',
    endpoint: '/api/offices/summary/',
    empty: 'Add an office to see its fleet summary.',
    table: 'Office fleet summary',
    metric: 'Active vehicles',
    label: 'Central office · Salvador',
    zeros: [
      {
        ...offices[0],
        active_vehicle_count: 0,
        maintenance_cost_last_year: '0.00',
        last_maintenance: null,
      },
    ],
  },
  {
    path: '/mechanics/workload',
    endpoint: '/api/mechanics/workload/',
    empty: 'Add a mechanic to see their workload.',
    table: 'Mechanic workload',
    metric: 'Maintenance records',
    label: 'Alex Pereira',
    zeros: [{ ...mechanics[0], maintenance_count: 0, total_maintenance_cost: '0.00' }],
  },
]) {
  test(`${report.path} distinguishes loading, request failures, empty reports and zero-valued records`, async ({
    page,
  }) => {
    let fail = true;
    let records: OfficeSummary[] | MechanicWorkload[] = [];
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**${report.endpoint}`, async (route) => {
      await pending;
      if (fail) await route.abort('failed');
      else await route.fulfill({ json: records });
    });
    await page.goto(report.path);
    await expect(
      page.getByRole('progressbar', { name: 'Loading records', exact: true }),
    ).toBeVisible();
    release();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Could not reach the API',
    );
    fail = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText(report.empty, { exact: true })).toBeVisible();
    await expect(page.getByRole('table', { name: report.table, exact: true })).toHaveCount(0);
    records = report.zeros;
    await page.reload();
    const row = page
      .getByRole('table', { name: report.table, exact: true })
      .getByRole('row')
      .nth(1);
    await expect(row).toContainText('$0.00');
    await expect(page.getByText(report.empty, { exact: true })).toHaveCount(0);
    await expectChartValues(page, report.metric, [{ label: report.label, value: '0' }]);
    await expect(
      page.getByText('All values are zero for this metric.', { exact: true }),
    ).toBeVisible();
  });
}

test('keeps report charts and navigation usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockReports(page);
  await page.goto('/offices/summary');
  await expectSelectedTab(page, 'Fleet summary', 'Offices');
  await expectChartValues(
    page,
    'Active vehicles',
    offices.map((office) => ({
      label: `${office.name} · ${office.city}`,
      value: String(office.active_vehicle_count),
    })),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await capture(page, 'mobile-fleet-summary');
  await page.getByRole('combobox', { name: /^Section\b/ }).click();
  await page.getByRole('option', { name: 'Mechanics', exact: true }).click();
  await page.getByRole('tab', { name: 'Workload', exact: true }).click();
  await expectSelectedTab(page, 'Mechanic workload', 'Mechanics');
  await expectChartValues(
    page,
    'Maintenance records',
    mechanics.map((mechanic) => ({
      label: mechanic.name,
      value: String(mechanic.maintenance_count),
    })),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await capture(page, 'mobile-mechanic-workload');
});
