'use client';

import { Autocomplete, Button, CircularProgress, TextField } from '@mui/material';
import { useId, useState, type ReactNode } from 'react';
import { useController, useFormContext, type FieldPath, type FieldValues } from 'react-hook-form';
import { useAutocompleteOptions } from '@/hooks/api/use-autocomplete-options';
import type { AutocompleteOption, AutocompleteSource } from '@/lib/api/autocomplete';

type Props<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  source: AutocompleteSource;
  required?: boolean;
  disabled?: boolean;
  helperText?: ReactNode;
  initialOption?: AutocompleteOption;
};

export function RHFAsyncAutocomplete<T extends FieldValues = FieldValues>({
  name,
  label,
  source,
  required,
  disabled,
  helperText,
  initialOption,
}: Props<T>) {
  const id = useId();
  const { control } = useFormContext<T>();
  const { field, fieldState } = useController({
    name,
    control,
    disabled,
  });
  const selectedId = String(field.value ?? '');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ text: string; selectedId: string } | null>(null);
  const search = draft?.selectedId === selectedId ? draft.text : '';
  const options = useAutocompleteOptions(source, search, open, selectedId, initialOption);
  const inputValue =
    draft?.selectedId === selectedId ? draft.text : (options.selectedOption?.label ?? '');
  const tooShort = search.trim().length === 1;
  const retryButton = (
    <Button
      size="small"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void options.refetch()}
    >
      Retry
    </Button>
  );
  const hint = options.isError ? (
    <>Could not load options. {open ? 'Press Enter to retry.' : retryButton}</>
  ) : (
    (helperText ?? 'Type at least 2 characters to search, or open to browse.')
  );

  return (
    <Autocomplete<AutocompleteOption>
      id={id}
      fullWidth
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false);
        setDraft(null);
      }}
      value={options.selectedOption}
      inputValue={inputValue}
      options={options.options}
      filterOptions={(items) => items}
      getOptionLabel={(option) => option.label}
      getOptionKey={(option) => option.id}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      loading={options.loading}
      noOptionsText={
        options.isError ? (
          <>Could not load options. {retryButton}</>
        ) : tooShort ? (
          'Type at least 2 characters to search.'
        ) : (
          'No matches found.'
        )
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter' && open && options.isError) {
          event.preventDefault();
          event.defaultMuiPrevented = true;
          void options.refetch();
        }
      }}
      onInputChange={(_, value, reason) => {
        if (reason === 'input') {
          // Editing a label invalidates the previous ID until another option is chosen.
          setDraft({ text: value, selectedId: '' });
          if (selectedId) field.onChange('');
        } else if (reason === 'clear') {
          setDraft(null);
          field.onChange('');
        }
      }}
      onChange={(_, option) => {
        options.selectOption(option);
        setDraft(null);
        field.onChange(option?.id ?? '');
      }}
      onHighlightChange={(_, option, reason) => {
        if (reason === 'keyboard' && option?.id === options.options.at(-1)?.id) {
          void options.fetchNextPage();
        }
      }}
      slotProps={{
        listbox: {
          onScroll: (event) => {
            const list = event.currentTarget;
            if (list.scrollHeight - list.scrollTop - list.clientHeight < 48) {
              void options.fetchNextPage();
            }
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          name={field.name}
          inputRef={field.ref}
          onBlur={field.onBlur}
          label={label}
          required={required}
          placeholder="Type to search…"
          error={Boolean(fieldState.error) || options.isError}
          helperText={fieldState.error?.message ?? hint}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {(options.loading || options.isFetchingNextPage) && (
                    <CircularProgress color="inherit" size={18} aria-label="Loading options" />
                  )}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
            htmlInput: params.inputProps,
          }}
        />
      )}
    />
  );
}
