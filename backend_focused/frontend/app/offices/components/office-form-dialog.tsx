'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, Grid } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { MascotDialogTitle } from '@/components/mascot/mascot-dialog-title';
import type { Office } from '@/lib/api/types';
import type { OfficeFormValues } from '@/lib/validation/form-schemas';
import { useOfficeForm } from '../hooks/use-office-form';

type Props = {
  office: Office | null;
  onClose: () => void;
  onSaved: () => void;
};

export function OfficeFormDialog({ office, onClose, onSaved }: Props) {
  const { form, submit, isPending } = useOfficeForm(office, onSaved);
  const error = form.formState.errors.root?.server?.message;

  return (
    <Dialog
      open
      onClose={isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="office-form-title"
    >
      <FormProvider {...form}>
        <form onSubmit={submit} noValidate>
          <MascotDialogTitle id="office-form-title">
            {office ? 'Edit office' : 'Add office'}
          </MascotDialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              {error && (
                <Grid size={12}>
                  <Alert severity="error">{error}</Alert>
                </Grid>
              )}
              <Grid size={12}>
                <RHFTextField<OfficeFormValues>
                  name="name"
                  label="Office name"
                  required
                  autoFocus
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
              </Grid>
              <Grid size={12}>
                <RHFTextField<OfficeFormValues>
                  name="city"
                  label="City"
                  required
                  disabled={isPending}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={isPending}>
              {office ? 'Save changes' : 'Create office'}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
}
