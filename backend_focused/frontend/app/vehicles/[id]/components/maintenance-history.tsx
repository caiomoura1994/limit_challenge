'use client';

import Link from 'next/link';
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { VehicleDetail } from '@/lib/api/types';
import { MaintenanceHistoryTable } from './maintenance-history-table';

export function MaintenanceHistory({
  records,
  vehicleId,
}: {
  records: VehicleDetail['maintenance_records'];
  vehicleId: number;
}) {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={1}
        alignItems={{ sm: 'center' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6">Maintenance history</Typography>
          <Typography variant="body2" color="text.secondary">
            {records.length} records · complete history · newest first
          </Typography>
        </Stack>
        <Button component={Link} href={`/maintenance?vehicle=${vehicleId}`} variant="outlined">
          Manage maintenance
        </Button>
      </Stack>
      {!records.length ? (
        <Alert severity="info">No maintenance has been recorded for this vehicle yet.</Alert>
      ) : (
        <MaintenanceHistoryTable records={records} />
      )}
    </Stack>
  );
}
