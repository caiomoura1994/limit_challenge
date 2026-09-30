'use client';

import { TextField, TextFieldProps } from '@mui/material';
import { useId } from 'react';
import { Controller, FieldPath, FieldValues, useFormContext } from 'react-hook-form';

export type RHFTextFieldProps<T extends FieldValues> = Omit<
  TextFieldProps,
  'name' | 'value' | 'defaultValue' | 'onChange' | 'error'
> & {
  name: FieldPath<T>;
  numeric?: boolean;
};

export function RHFTextField<T extends FieldValues = FieldValues>({
  name,
  numeric = false,
  helperText,
  required,
  disabled,
  ...props
}: RHFTextFieldProps<T>) {
  const { control } = useFormContext<T>();
  const id = useId();
  return (
    <Controller
      name={name}
      control={control}
      disabled={disabled}
      render={({ field: { ref, value, onChange, ...field }, fieldState }) => (
        <TextField
          {...props}
          {...field}
          id={props.id ?? id}
          inputRef={ref}
          required={required}
          value={value ?? ''}
          onChange={(event) =>
            onChange(
              numeric && event.target.value !== ''
                ? Number(event.target.value)
                : event.target.value,
            )
          }
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
        />
      )}
    />
  );
}
