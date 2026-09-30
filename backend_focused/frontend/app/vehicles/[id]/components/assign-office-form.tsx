'use client';

import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { RHFAsyncAutocomplete } from '@/components/forms/rhf-async-autocomplete';
import { officeAutocomplete } from '@/lib/api/autocomplete';
import type { VehicleDetail } from '@/lib/api/types';
import type { OfficeAssignmentValues } from '@/lib/validation/form-schemas';
import { useOfficeAssignment } from '../hooks/use-office-assignment';

export function AssignOfficeForm({ vehicle }: { vehicle: VehicleDetail }) {
  const { form, submit, isPending } = useOfficeAssignment(vehicle.id, vehicle.office.id);
  const error = form.formState.errors.root?.server?.message;
  return (
    <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
      <FormProvider {...form}>
        <Stack component="form" noValidate spacing={2} onSubmit={submit}>
          <Typography variant="h6">Office assignment</Typography>
          <Typography variant="body2" color="text.secondary">
            Currently at {vehicle.office.name} in {vehicle.office.city}.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <RHFAsyncAutocomplete<OfficeAssignmentValues>
            name="office"
            label="Office"
            required
            source={officeAutocomplete}
            initialOption={{
              id: String(vehicle.office.id),
              label: `${vehicle.office.name} · ${vehicle.office.city}`,
            }}
          />
          <Button
            type="submit"
            variant="outlined"
            loading={isPending}
            disabled={!form.formState.isDirty}
            sx={{ alignSelf: 'flex-start' }}
          >
            Update assignment
          </Button>
        </Stack>
      </FormProvider>
    </Paper>
  );
}
