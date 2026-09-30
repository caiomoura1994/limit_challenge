'use client';

import { Grid } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { FilterPanel } from '@/components/filter-panel';
import { RHFAsyncAutocomplete } from '@/components/forms/rhf-async-autocomplete';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { mechanicAutocomplete, vehicleAutocomplete } from '@/lib/api/autocomplete';
import type {
  MaintenanceFilterValues,
  useMaintenanceFilters,
} from '../hooks/use-maintenance-filters';

type Props = {
  search: ReturnType<typeof useMaintenanceFilters>;
};

export function MaintenanceFilters({ search }: Props) {
  return (
    <FormProvider {...search.form}>
      <FilterPanel
        title="Search maintenance"
        description="Find completed work by vehicle, mechanic, or maintenance date. Dates include both ends of the period."
        onSubmit={search.form.handleSubmit(search.apply)}
        onClear={search.reset}
      >
        <Grid container spacing={2}>
          <Grid size={12}>
            <RHFTextField<MaintenanceFilterValues>
              name="search"
              label="Search"
              placeholder="Maintenance type, notes, vehicle or mechanic"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <RHFAsyncAutocomplete<MaintenanceFilterValues>
              name="vehicle"
              label="Vehicle"
              source={vehicleAutocomplete}
              helperText="Leave empty for all vehicles."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <RHFAsyncAutocomplete<MaintenanceFilterValues>
              name="mechanic"
              label="Mechanic"
              source={mechanicAutocomplete}
              helperText="Leave empty for all mechanics."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <RHFTextField<MaintenanceFilterValues>
              name="maintenance_date_after"
              label="Maintained from"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <RHFTextField<MaintenanceFilterValues>
              name="maintenance_date_before"
              label="Maintained through"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        </Grid>
      </FilterPanel>
    </FormProvider>
  );
}
