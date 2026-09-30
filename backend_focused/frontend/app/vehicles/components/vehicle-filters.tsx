'use client';

import { Grid } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import { FilterPanel } from '@/components/filter-panel';
import { RHFAsyncAutocomplete } from '@/components/forms/rhf-async-autocomplete';
import { RHFSelect } from '@/components/forms/rhf-select';
import { RHFTextField } from '@/components/forms/rhf-text-field';
import { officeAutocomplete } from '@/lib/api/autocomplete';
import type { useVehicleFilters, VehicleFilterValues } from '../hooks/use-vehicle-filters';

type Props = {
  search: ReturnType<typeof useVehicleFilters>;
};

export function VehicleFilters({ search }: Props) {
  return (
    <FormProvider {...search.form}>
      <FilterPanel
        title="Search vehicles"
        description="Search by VIN, license plate, make or model. Combine with exact-match filters and maintenance dates below."
        onSubmit={search.form.handleSubmit(search.apply)}
        onClear={search.reset}
      >
        <Grid container spacing={2}>
          <Grid size={12}>
            <RHFTextField<VehicleFilterValues>
              name="search"
              label="Search"
              placeholder="VIN, license plate, make or model"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFAsyncAutocomplete<VehicleFilterValues>
              name="office"
              label="Office"
              source={officeAutocomplete}
              helperText="Leave empty for all offices."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFSelect<VehicleFilterValues>
              name="active"
              label="Status"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFTextField<VehicleFilterValues> name="make" label="Make" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFTextField<VehicleFilterValues> name="model" label="Model" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFTextField<VehicleFilterValues>
              name="maintenance_date_after"
              label="Maintained from"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <RHFTextField<VehicleFilterValues>
              name="maintenance_date_before"
              label="Maintained through"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <RHFTextField<VehicleFilterValues>
              name="mechanic_certification_number"
              label="Mechanic certification number"
            />
          </Grid>
        </Grid>
      </FilterPanel>
    </FormProvider>
  );
}
