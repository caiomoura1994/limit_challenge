'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useForm, type Resolver } from 'react-hook-form';

export function useListFilters<T extends Record<string, string>>(
  defaults: T,
  resolver?: Resolver<T>,
) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const values = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, params.get(key) ?? value]),
      ) as T,
    [defaults, params],
  );
  const form = useForm<T>({ resolver, values });
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  function navigate(next: URLSearchParams) {
    router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  function apply(submitted: T) {
    const next = new URLSearchParams();
    for (const key of Object.keys(defaults)) {
      // Disabled RHF controls are omitted; preserve their existing URL filter.
      const value = (submitted[key] ?? values[key]).trim();
      if (value) next.set(key, value);
    }
    navigate(next);
  }

  function reset() {
    form.reset(defaults);
    navigate(new URLSearchParams());
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(params.toString());
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    navigate(next);
  }

  return {
    form,
    values,
    page,
    apply,
    reset,
    setPage,
    hasFilters: Object.values(values).some((value) => value.trim() !== ''),
  };
}
