import { z } from 'zod';

const requiredMessage = 'This field is required.';

function requiredTrimmedString({
  emptyMessage,
  max,
  maxMessage,
  missingMessage = requiredMessage,
}: {
  emptyMessage: string;
  max: number;
  maxMessage: string;
  missingMessage?: string;
}) {
  return z
    .string()
    .min(1, missingMessage)
    .max(max, maxMessage)
    .refine((value) => value.trim().length > 0, emptyMessage);
}

const optionalString = z.string();
const selectedId = (message: string) => z.string().min(1, message);

function localDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const officeFormSchema = z.object({
  name: requiredTrimmedString({
    emptyMessage: 'Enter an office name.',
    max: 255,
    maxMessage: 'Use 255 characters or fewer.',
  }),
  city: requiredTrimmedString({
    emptyMessage: 'Enter a city.',
    max: 255,
    maxMessage: 'Use 255 characters or fewer.',
  }),
});

export type OfficeFormValues = z.infer<typeof officeFormSchema>;

export const mechanicFormSchema = z.object({
  name: requiredTrimmedString({
    emptyMessage: 'Enter a name.',
    max: 255,
    maxMessage: 'Use 255 characters or fewer.',
  }),
  certification_number: requiredTrimmedString({
    emptyMessage: 'Enter a certification number.',
    max: 100,
    maxMessage: 'Use 100 characters or fewer.',
  }),
  active: z.boolean(),
});

export type MechanicFormValues = z.infer<typeof mechanicFormSchema>;

const yearSchema = z
  .string()
  .min(1, 'Enter the year.')
  .refine((value) => Number.isInteger(Number(value)), 'Enter a whole number.')
  .refine((value) => Number(value) >= 0, 'Year must be zero or greater.')
  .refine((value) => Number(value) <= 32767, 'Year must be 32767 or less.');

export const vehicleFormSchema = z.object({
  vin: requiredTrimmedString({
    emptyMessage: 'Enter the VIN.',
    max: 17,
    maxMessage: 'Use 17 characters or fewer.',
    missingMessage: 'Enter the VIN.',
  }),
  license_plate: requiredTrimmedString({
    emptyMessage: 'Enter the license plate.',
    max: 20,
    maxMessage: 'Use 20 characters or fewer.',
    missingMessage: 'Enter the license plate.',
  }),
  make: requiredTrimmedString({
    emptyMessage: 'Enter the make.',
    max: 100,
    maxMessage: 'Use 100 characters or fewer.',
    missingMessage: 'Enter the make.',
  }),
  model: requiredTrimmedString({
    emptyMessage: 'Enter the model.',
    max: 100,
    maxMessage: 'Use 100 characters or fewer.',
    missingMessage: 'Enter the model.',
  }),
  year: yearSchema,
  office: selectedId('Choose an office.'),
  active: z.boolean(),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

export const maintenanceFormSchema = z.object({
  vehicle: selectedId(requiredMessage),
  mechanic: selectedId(requiredMessage),
  maintenance_date: z
    .string()
    .min(1, requiredMessage)
    .refine((value) => value <= localDateInputValue(), {
      message: 'Maintenance date cannot be in the future.',
    }),
  maintenance_type: requiredTrimmedString({
    emptyMessage: 'Enter the maintenance type.',
    max: 100,
    maxMessage: 'Use 100 characters or fewer.',
  }),
  cost: z
    .string()
    .min(1, requiredMessage)
    .regex(/^\d{1,10}(\.\d{1,2})?$/, {
      message: 'Enter zero or a positive cost with up to 10 whole digits and 2 decimals.',
    }),
  notes: optionalString,
});

export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;

export const officeAssignmentSchema = z.object({
  office: selectedId('Choose an office.'),
});

export type OfficeAssignmentValues = z.infer<typeof officeAssignmentSchema>;

export const officeFilterSchema = z.object({
  search: optionalString,
});

export type OfficeFilterValues = z.infer<typeof officeFilterSchema>;

export const mechanicFilterSchema = z.object({
  search: optionalString,
  active: z.union([z.literal(''), z.literal('true'), z.literal('false')]),
});

export type MechanicFilterValues = z.infer<typeof mechanicFilterSchema>;

const dateRangeMessage = 'Choose a date on or after the start date.';

type DateRange = {
  maintenance_date_after: string;
  maintenance_date_before: string;
};

function hasValidDateRange({ maintenance_date_after, maintenance_date_before }: DateRange) {
  return (
    !maintenance_date_after ||
    !maintenance_date_before ||
    maintenance_date_before >= maintenance_date_after
  );
}

export const maintenanceFilterSchema = z
  .object({
    search: optionalString,
    vehicle: optionalString,
    mechanic: optionalString,
    maintenance_date_after: optionalString,
    maintenance_date_before: optionalString,
  })
  .refine(hasValidDateRange, {
    path: ['maintenance_date_before'],
    message: dateRangeMessage,
  });

export type MaintenanceFilterValues = z.infer<typeof maintenanceFilterSchema>;

export const vehicleFilterSchema = z
  .object({
    search: optionalString,
    office: optionalString,
    active: z.union([z.literal(''), z.literal('true'), z.literal('false')]),
    make: optionalString,
    model: optionalString,
    maintenance_date_after: optionalString,
    maintenance_date_before: optionalString,
    mechanic_certification_number: optionalString,
  })
  .refine(hasValidDateRange, {
    path: ['maintenance_date_before'],
    message: dateRangeMessage,
  });

export type VehicleFilterValues = z.infer<typeof vehicleFilterSchema>;
