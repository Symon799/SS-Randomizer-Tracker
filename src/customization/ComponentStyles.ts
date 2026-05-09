import { type StylesConfig } from 'react-select';

export function selectStyles<IsMulti extends boolean, Option>(): StylesConfig<
    Option,
    IsMulti
> {
    return {
        control: (baseStyles, state) => ({
            ...baseStyles,
            color: 'var(--scheme-text)',
            minHeight: '38px',
            borderRadius: 8,
            backgroundColor:
                'color-mix(in srgb, var(--scheme-background) 94%, white)',
            borderColor:
                'color-mix(in srgb, var(--scheme-text) 18%, transparent)',
            boxShadow: state.isFocused
                ? '0 0 0 3px color-mix(in srgb, var(--scheme-interact) 18%, transparent)'
                : '0 1px 2px color-mix(in srgb, var(--scheme-text) 8%, transparent)',
            ...(state.isFocused
                ? {
                      borderColor: 'var(--scheme-interact)',
                  }
                : undefined),
            '&:hover': {
                borderColor: 'var(--scheme-interact)',
            },
        }),
        valueContainer: (baseStyles) => ({
            ...baseStyles,
            padding: '2px 10px',
        }),
        menu: (baseStyles) => ({
            ...baseStyles,
            zIndex: 20,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: 'var(--scheme-background)',
            boxShadow:
                '0 0 0 1px color-mix(in srgb, var(--scheme-text) 12%, transparent), 0 12px 30px color-mix(in srgb, var(--scheme-text) 18%, transparent)',
        }),
        option: (baseStyles, state) => ({
            ...baseStyles,
            color: state.isFocused
                ? 'var(--scheme-interact-text)'
                : 'var(--scheme-text)',
            backgroundColor: state.isFocused
                ? 'var(--scheme-interact)'
                : 'var(--scheme-background)',
        }),
        singleValue: (baseStyles) => ({
            ...baseStyles,
            color: `color-mix(in srgb, var(--scheme-text) 90%, transparent)`,
        }),
    };
}
