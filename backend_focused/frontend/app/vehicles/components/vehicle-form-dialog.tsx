'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, Grid, Stack } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { RHFAsyncAutocomplete } from '@/components/forms/rhf-async-autocomplete';
import { RHFSwitch } from '@/components/forms/rhf-switch';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { MascotDialogTitle } from '@/components/mascot/mascot-dialog-title';
import { officeAutocomplete } from '@/lib/api/autocomplete';
import type { Vehicle } from '@/lib/api/types';
import { useVehicleForm, type VehicleFormValues } from '../hooks/use-vehicle-form';

type Props = {
  vehicle?: Vehicle;
  onClose: () => void;
  onSaved: (saved: Vehicle) => void;
};

export function VehicleFormDialog({ vehicle, onClose, onSaved }: Props) {
  const { form, submit, isPending } = useVehicleForm(vehicle, onSaved);
  const serverError = form.formState.errors.root?.server?.message;

  return (
    <Dialog
      open
      onClose={isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="vehicle-form-title"
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate>
          <MascotDialogTitle id="vehicle-form-title">
            {vehicle ? 'Edit vehicle' : 'Add vehicle'}
          </MascotDialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {serverError && <Alert severity="error">{serverError}</Alert>}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<VehicleFormValues> name="make" label="Make" required />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<VehicleFormValues> name="model" label="Model" required />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<VehicleFormValues>
                    name="year"
                    label="Year"
                    type="number"
                    required
                    slotProps={{ htmlInput: { min: 0, max: 32767, step: 1 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <RHFTextField<VehicleFormValues>
                    name="license_plate"
                    label="License plate"
                    required
                  />
                </Grid>
                <Grid size={12}>
                  <RHFTextField<VehicleFormValues> name="vin" label="VIN" required />
                </Grid>
                <Grid size={12}>
                  <RHFAsyncAutocomplete<VehicleFormValues>
                    name="office"
                    label="Office"
                    required
                    source={officeAutocomplete}
                  />
                </Grid>
                <Grid size={12}>
                  <RHFSwitch<VehicleFormValues> name="active" label="Active vehicle" />
                </Grid>
              </Grid>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={isPending}>
              {vehicle ? 'Save changes' : 'Create vehicle'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
