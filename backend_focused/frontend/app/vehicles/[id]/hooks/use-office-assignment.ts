'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useFeedback } from '@/components/feedback-provider';
import { useAssignOffice } from '@/hooks/api/use-vehicles';
import { applyFormErrors } from '@/lib/form-errors';
import { officeAssignmentSchema, type OfficeAssignmentValues } from '@/lib/validation/form-schemas';

export function useOfficeAssignment(vehicleId: number, officeId: number) {
  const form = useForm<OfficeAssignmentValues>({
    resolver: zodResolver(officeAssignmentSchema),
    values: { office: String(officeId) },
  });
  const mutation = useAssignOffice();
  const { notify } = useFeedback();

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    try {
      await mutation.mutateAsync({ id: vehicleId, office: Number(values.office) });
      form.reset(values);
      notify('Office assignment updated.');
    } catch (error) {
      applyFormErrors(error, form.setError, ['office']);
    }
  });

  return { form, submit, isPending: mutation.isPending };
}
