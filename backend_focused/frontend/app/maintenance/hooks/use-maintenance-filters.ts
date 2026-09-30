'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useListFilters } from '@/hooks/use-list-filters';
import type { MaintenanceFilters } from '@/lib/api/types';
import {
  maintenanceFilterSchema,
  type MaintenanceFilterValues,
} from '@/lib/validation/form-schemas';

export type { MaintenanceFilterValues } from '@/lib/validation/form-schemas';

const defaults: MaintenanceFilterValues = {
  search: '',
  vehicle: '',
  mechanic: '',
  maintenance_date_after: '',
  maintenance_date_before: '',
};

export function useMaintenanceFilters() {
  const state = useListFilters(defaults, zodResolver(maintenanceFilterSchema));
  const { values, page } = state;
  const filters: MaintenanceFilters = {
    page,
    search: values.search || undefined,
    vehicle: values.vehicle ? Number(values.vehicle) : undefined,
    mechanic: values.mechanic ? Number(values.mechanic) : undefined,
    maintenance_date_after: values.maintenance_date_after || undefined,
    maintenance_date_before: values.maintenance_date_before || undefined,
  };
  return { ...state, filters };
}
