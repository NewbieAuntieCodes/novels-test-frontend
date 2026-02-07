// styles.ts
// Consistent naming and structure for style objects
// FIX: Import CSSProperties type from react to resolve namespace errors.
import type { CSSProperties } from 'react';

export const COLORS = {
  primary: '#007bff',
  primaryHover: '#0056b3',
  secondary: '#6c757d',
  secondaryHover: '#545b62',
  success: '#28a745',
  successHover: '#1e7e34',
  danger: '#dc3545',
  dangerHover: '#c82333',
  dangerLight: '#f8d7da',
  warning: '#ffc107',
  warningHover: '#e0a800',
  info: '#17a2b8',
  infoHover: '#117a8b',
  light: '#f8f9fa',
  dark: '#343a40',
  white: '#ffffff',
  black: '#000000',
  gray100: '#f8f9fa',
  gray200: '#e9ecef',
  gray300: '#dee2e6',
  gray400: '#ced4da',
  gray500: '#adb5bd',
  gray600: '#6c757d',
  gray700: '#495057',
  gray800: '#343a40',
  gray900: '#212529',
  text: '#333',
  textLight: '#555',
  textLighter: '#777',
  border: '#ccc',
  borderLight: '#eee',
  background: '#f4f4f9',
  panelBackground: '#ffffff',
  highlightBackground: '#e6f7ff',
  highlightBorder: '#91d5ff',
};

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '30px',
  sectionGap: '30px', // Consistent gap between page sections
  elementGap: '10px', // Consistent gap between elements within a group
};

export const FONTS = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  sizeBase: '1rem',
  sizeSmall: '0.9rem',
  sizeLarge: '1.1rem',
  sizeH1: '2em',
  sizeH2: '1.75em',
  sizeH3: '1.5em',
};

export const BORDERS = {
  radius: '4px',
  width: '1px',
  style: 'solid',
  color: COLORS.border,
};

export const SHADOWS = {
  small: '0 2px 4px rgba(0, 0, 0, 0.05)',
  medium: '0 4px 12px rgba(0, 0, 0, 0.1)',
  large: '0 10px 30px rgba(0, 0, 0, 0.2)',
};

// FIX: Use CSSProperties instead of React.CSSProperties
export const baseButtonStyles: CSSProperties = {
  padding: `${SPACING.sm} ${SPACING.lg}`,
  backgroundColor: COLORS.primary,
  color: COLORS.white,
  border: 'none',
  borderRadius: BORDERS.radius,
  cursor: 'pointer',
  transition: 'background-color 0.2s, box-shadow 0.2s',
  fontSize: FONTS.sizeSmall,
  textAlign: 'center',
  textDecoration: 'none',
  display: 'inline-block',
};

// FIX: Use CSSProperties instead of React.CSSProperties
export const baseButtonHoverStyles: CSSProperties = {
    backgroundColor: COLORS.primaryHover,
    boxShadow: SHADOWS.small,
};

// FIX: Use CSSProperties instead of React.CSSProperties
export const baseInputStyles: CSSProperties = {
  padding: SPACING.sm,
  border: `${BORDERS.width} ${BORDERS.style} ${BORDERS.color}`,
  borderRadius: BORDERS.radius,
  boxSizing: 'border-box',
  backgroundColor: COLORS.white,
  fontSize: FONTS.sizeSmall,
  width: '100%',
  color: COLORS.text,
};

// FIX: Use CSSProperties instead of React.CSSProperties
export const baseInputFocusStyles: CSSProperties = {
    borderColor: COLORS.primary,
    boxShadow: `0 0 0 0.2rem ${COLORS.primary}40`,
    outline: 'none',
};

// FIX: Use CSSProperties instead of React.CSSProperties
export const inputGroupStyles: CSSProperties = {
  display: 'flex',
  gap: SPACING.elementGap,
  alignItems: 'center',
};

export const panelStyles = {
  padding: SPACING.lg,
  boxSizing: 'border-box' as const,
  overflowY: 'auto' as const,
  backgroundColor: COLORS.panelBackground,
  display: 'flex',
  flexDirection: 'column' as const,
  height: '100%',
};

export const globalPlaceholderTextStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    fontSize: '1.2em',
    color: COLORS.textLighter,
    flexGrow: 1,
    textAlign: 'center' as const,
    padding: SPACING.xl,
};
