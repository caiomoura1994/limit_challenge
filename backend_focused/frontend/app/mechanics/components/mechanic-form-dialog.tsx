'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, Grid } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { RHFSwitch } from '@/components/forms/rhf-switch';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { MascotDialogTitle } from '@/components/mascot/mascot-dialog-title';
import type { Mechanic } from '@/lib/api/types';
import type { MechanicFormValues } from '@/lib/validation/form-schemas';
import { useMechanicForm } from '../hooks/use-mechanic-form';

type Props = {
  mechanic: Mechanic | null;
  onClose: () => void;
  onSaved: () => void;
};

export function MechanicFormDialog({ mechanic, onClose, onSaved }: Props) {
  const { form, submit, isPending } = useMechanicForm(mechanic, onSaved);
  const error = form.formState.errors.root?.server?.message;

  return (
    <Dialog
      open
      onClose={isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="mechanic-form-title"
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate>
          <MascotDialogTitle id="mechanic-form-title">
            {mechanic ? 'Edit mechanic' : 'Add mechanic'}
          </MascotDialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              {error && (
                <Grid size={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
              <Grid size={12}>
                <RHFTextField<MechanicFormValues>
                  name="name"
                  label="Name"
                  required
                  autoFocus
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
              </Grid>
              <Grid size={12}>
                <RHFTextField<MechanicFormValues>
                  name="certification_number"
                  label="Certification number"
                  required
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
              </Grid>
              <Grid size={12}>
                <RHFSwitch<MechanicFormValues>
                  name="active"
                  label="Active mechanic"
                  disabled={isPending}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={isPending}>
              {mechanic ? 'Save changes' : 'Create mechanic'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
