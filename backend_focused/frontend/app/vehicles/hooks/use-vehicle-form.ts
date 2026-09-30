'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSaveVehicle } from '@/hooks/api/use-vehicles';
import { useFeedback } from '@/components/feedback-provider';
import { applyFormErrors } from '@/lib/form-errors';
import type { Vehicle } from '@/lib/api/types';
import { vehicleFormSchema, type VehicleFormValues } from '@/lib/validation/form-schemas';

export type { VehicleFormValues } from '@/lib/validation/form-schemas';

export function useVehicleForm(vehicle: Vehicle | undefined, onSaved: (saved: Vehicle) => void) {
  const mutation = useSaveVehicle();
  const { notify } = useFeedback();
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      vin: vehicle?.vin ?? '',
      license_plate: vehicle?.license_plate ?? '',
      make: vehicle?.make ?? '',
      model: vehicle?.model ?? '',
      year: vehicle ? String(vehicle.year) : '',
      office: vehicle ? String(vehicle.office) : '',
      active: vehicle?.active ?? true,
    },
  });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    try {
      const saved = await mutation.mutateAsync({
        id: vehicle?.id,
        data: {
          ...values,
          vin: values.vin.trim(),
          license_plate: values.license_plate.trim(),
          make: values.make.trim(),
          model: values.model.trim(),
          year: Number(values.year),
          office: Number(values.office),
        },
      });
      notify(vehicle ? 'Vehicle updated.' : 'Vehicle created.');
      onSaved(saved);
    } catch (error) {
      applyFormErrors(error, form.setError, [
        'vin',
        'license_plate',
        'make',
        'model',
        'year',
        'office',
        'active',
      ]);
    }
  });

  return { form, submit, isPending: mutation.isPending };
}
