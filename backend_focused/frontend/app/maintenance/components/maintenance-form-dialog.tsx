'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  InputAdornment,
  Stack,
} from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { RHFAsyncAutocomplete } from '@/components/forms/rhf-async-autocomplete';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { MascotDialogTitle } from '@/components/mascot/mascot-dialog-title';
import { mechanicAutocomplete, vehicleAutocomplete } from '@/lib/api/autocomplete';
import type { MaintenanceRecord } from '@/lib/api/types';
import { MaintenanceFormValues, useMaintenanceForm } from '../hooks/use-maintenance-form';

export function MaintenanceFormDialog({
  record,
  onClose,
  onSaved,
}: {
  record: MaintenanceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { form, submit, isPending } = useMaintenanceForm(record, onSaved);
  return (
    <Dialog open onClose={isPending ? undefined : onClose} aria-labelledby="maintenance-form-title">
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate>
          <MascotDialogTitle id="maintenance-form-title">
            {record ? 'Edit maintenance record' : 'Add maintenance record'}
          </MascotDialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {form.formState.errors.root?.server?.message && (
                <Alert severity="error">{form.formState.errors.root.server.message}</Alert>
              )}
              <Grid container spacing={2}>
                <Grid size={12}>
                  <RHFAsyncAutocomplete<MaintenanceFormValues>
                    name="vehicle"
                    label="Vehicle"
                    required
                    source={vehicleAutocomplete}
                  />
                </Grid>
                <Grid size={12}>
                  <RHFAsyncAutocomplete<MaintenanceFormValues>
                    name="mechanic"
                    label="Mechanic"
                    required
                    source={mechanicAutocomplete}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<MaintenanceFormValues>
                    name="maintenance_date"
                    label="Maintenance date"
                    type="date"
                    required
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<MaintenanceFormValues>
                    name="cost"
                    label="Cost"
                    required
                    helperText="Up to two decimal places."
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      },
                      htmlInput: { inputMode: 'decimal' },
                    }}
                  />
                </Grid>
                <Grid size={12}>
                  <RHFTextField<MaintenanceFormValues>
                    name="maintenance_type"
                    label="Maintenance type"
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <RHFTextField<MaintenanceFormValues>
                    name="notes"
                    label="Notes"
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={isPending}>
              {record ? 'Save changes' : 'Create record'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
