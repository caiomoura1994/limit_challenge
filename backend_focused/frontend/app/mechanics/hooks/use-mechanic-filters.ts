'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useListFilters } from '@/hooks/use-list-filters';
import type { MechanicFilters } from '@/lib/api/types';
import { mechanicFilterSchema, type MechanicFilterValues } from '@/lib/validation/form-schemas';

const defaults: MechanicFilterValues = { search: '', active: '' };

export type { MechanicFilterValues } from '@/lib/validation/form-schemas';

export function useMechanicFilters() {
  const state = useListFilters(defaults, zodResolver(mechanicFilterSchema));
  const filters: MechanicFilters = {
    page: state.page,
    search: state.values.search || undefined,
    active:
      state.values.active === 'true' ? true : state.values.active === 'false' ? false : undefined,
  };

  return { ...state, filters };
}
