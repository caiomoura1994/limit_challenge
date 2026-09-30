'use client';

import { LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { PageHeader } from '@/components/page-header';
import { SectionTabs } from '@/components/navigation/section-tabs';
import { QueryState } from '@/components/query-state';
import { ReportChart } from '@/components/reports/report-chart';
import { ReportControls } from '@/components/reports/report-controls';
import { useOfficeSummary } from '@/hooks/api/use-offices';
import { useReportDisplay } from '@/hooks/use-report-display';
import { OfficeSummaryTable } from './office-summary-table';

export function OfficeSummaryScreen() {
  const summary = useOfficeSummary();
  const display = useReportDisplay();
  const metricLabel = display.metric === 'count' ? 'Active vehicles' : 'Maintenance cost';

  return (
    <>
      <PageHeader
        title="Offices"
        navigation={<SectionTabs />}
        description="Active vehicles and latest service across all offices. Maintenance costs cover the last 12 months."
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={3}>
          <ReportControls {...display} countLabel="Active vehicles" costLabel="Maintenance cost" />
          <QueryState
            isPending={summary.isPending}
            isError={summary.isError}
            error={summary.error}
            onRetry={() => summary.refetch()}
          />
          {summary.isFetching && !summary.isPending && (
            <LinearProgress aria-label="Refreshing fleet summary" />
          )}
          {summary.isSuccess &&
            (summary.data.length === 0 ? (
              <Typography color="text.secondary">
                Add an office to see its fleet summary.
              </Typography>
            ) : display.view === 'list' ? (
              <OfficeSummaryTable offices={summary.data} />
            ) : (
              <ReportChart
                rows={summary.data.map((office) => ({
                  label: `${office.name} · ${office.city}`,
                  value:
                    display.metric === 'count'
                      ? office.active_vehicle_count
                      : Number(office.maintenance_cost_last_year),
                }))}
                metricLabel={metricLabel}
                valueFormat={display.metric}
              />
            ))}
        </Stack>
      </Paper>
    </>
  );
}
