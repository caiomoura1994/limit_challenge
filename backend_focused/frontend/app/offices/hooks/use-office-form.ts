'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSaveOffice } from '@/hooks/api/use-offices';
import type { Office } from '@/lib/api/types';
import { applyFormErrors } from '@/lib/form-errors';
import { officeFormSchema, type OfficeFormValues } from '@/lib/validation/form-schemas';

export function useOfficeForm(office: Office | null, onSaved: () => void) {
  const form = useForm<OfficeFormValues>({
    resolver: zodResolver(officeFormSchema),
    defaultValues: { name: office?.name ?? '', city: office?.city ?? '' },
  });
  const save = useSaveOffice();

  const submit = form.handleSubmit(async (data) => {
    form.clearErrors();
    try {
      await save.mutateAsync({
        id: office?.id,
        data: { name: data.name.trim(), city: data.city.trim() },
      });
      onSaved();
    } catch (error) {
      applyFormErrors(error, form.setError, ['name', 'city']);
    }
  });

  return { form, submit, isPending: save.isPending };
}
