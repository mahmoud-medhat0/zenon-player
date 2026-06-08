import React from 'react';
import Select, { Props as SelectProps, StylesConfig } from 'react-select';
import { useTranslation } from 'react-i18next';

export interface OptionType {
  value: string;
  label: string;
}

export interface AdminSelectProps extends Omit<SelectProps<OptionType, false>, 'styles'> {
  // We can add any custom props if needed
}

export default function AdminSelect(props: AdminSelectProps) {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const customStyles: StylesConfig<OptionType, false> = {
    control: (base, state) => ({
      ...base,
      background: state.isFocused ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border-color)',
      borderRadius: '10px',
      padding: '2px', // React-select has inner padding, so we adjust to match 14px 16px total
      minHeight: '48px', // Matches padding 14px top/bottom
      boxShadow: state.isFocused ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)',
      },
      color: 'var(--text-main)',
      fontFamily: 'var(--font-family)',
      fontSize: '14px',
    }),
    menu: (base) => ({
      ...base,
      background: 'var(--bg-sidebar)', // Usually darker or matches modal
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      overflow: 'hidden',
      zIndex: 9999,
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
    }),
    option: (base, state) => ({
      ...base,
      background: state.isSelected
        ? 'var(--primary)'
        : state.isFocused
        ? 'rgba(255, 255, 255, 0.06)'
        : 'transparent',
      color: state.isSelected ? 'white' : 'var(--text-main)',
      borderRadius: '6px',
      cursor: 'pointer',
      padding: '10px 14px',
      fontSize: '14px',
      fontFamily: 'var(--font-family)',
      '&:active': {
        background: 'rgba(79, 70, 229, 0.5)',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--text-main)',
      fontSize: '14px',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--text-main)',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'rgba(148, 163, 184, 0.5)', // Matches app.css
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'var(--text-muted)',
      '&:hover': {
        color: 'var(--text-main)',
      },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--text-muted)',
      '&:hover': {
        color: '#ef4444',
      },
    }),
  };

  return (
    <Select<OptionType, false>
      styles={customStyles}
      isRtl={isRtl}
      {...props}
    />
  );
}
