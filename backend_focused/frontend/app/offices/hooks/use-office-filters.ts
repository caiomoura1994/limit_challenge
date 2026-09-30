'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useListFilters } from '@/hooks/use-list-filters';
import type { OfficeFilters } from '@/lib/api/types';
import { officeFilterSchema, type OfficeFilterValues } from '@/lib/validation/form-schemas';

const defaults: OfficeFilterValues = { search: '' };

export type { OfficeFilterValues } from '@/lib/validation/form-schemas';

export function useOfficeFilters() {
  const state = useListFilters(defaults, zodResolver(officeFilterSchema));
  const filters: OfficeFilters = {
    page: state.page,
    search: state.values.search || undefined,
  };

  return { ...state, filters };
}
