'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useForm } from 'react-hook-form';
import type { VehicleFilters } from '@/lib/api/types';
import { vehicleFilterSchema, type VehicleFilterValues } from '@/lib/validation/form-schemas';

export type { VehicleFilterValues } from '@/lib/validation/form-schemas';

export const emptyVehicleFilters: VehicleFilterValues = {
  search: '',
  office: '',
  active: '',
  make: '',
  model: '',
  maintenance_date_after: '',
  maintenance_date_before: '',
  mechanic_certification_number: '',
};

export function useVehicleFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const values = useMemo<VehicleFilterValues>(() => {
    const active = searchParams.get('active');
    return {
      search: searchParams.get('search') ?? '',
      office: searchParams.get('office') ?? '',
      active: active === 'true' || active === 'false' ? active : '',
      make: searchParams.get('make') ?? '',
      model: searchParams.get('model') ?? '',
      maintenance_date_after: searchParams.get('maintenance_date_after') ?? '',
      maintenance_date_before: searchParams.get('maintenance_date_before') ?? '',
      mechanic_certification_number: searchParams.get('mechanic_certification_number') ?? '',
    };
  }, [searchParams]);
  const form = useForm<VehicleFilterValues>({
    resolver: zodResolver(vehicleFilterSchema),
    values,
  });
  const requestedPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters: VehicleFilters = {
    page,
    search: values.search || undefined,
    office: values.office ? Number(values.office) : undefined,
    active: values.active ? values.active === 'true' : undefined,
    make: values.make || undefined,
    model: values.model || undefined,
    maintenance_date_after: values.maintenance_date_after || undefined,
    maintenance_date_before: values.maintenance_date_before || undefined,
    mechanic_certification_number: values.mechanic_certification_number || undefined,
  };

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function apply(nextValues: VehicleFilterValues) {
    const params = new URLSearchParams();
    // RHF omits disabled fields while the office options are loading or unavailable.
    const submittedValues = { ...nextValues, office: nextValues.office ?? values.office };
    for (const [key, value] of Object.entries(submittedValues)) {
      if (value.trim()) params.set(key, value.trim());
    }
    navigate(params);
  }

  function reset() {
    form.reset(emptyVehicleFilters);
    navigate(new URLSearchParams());
  }

  function setPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) params.delete('page');
    else params.set('page', String(nextPage));
    navigate(params);
  }

  return { form, filters, page, apply, reset, setPage };
}
