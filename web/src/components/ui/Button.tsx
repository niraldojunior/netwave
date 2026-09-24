import React, { type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3.5 py-1.5 text-xs font-medium gap-2',
    lg: 'px-4 py-2 text-sm font-medium gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[#FFD919] hover:bg-[#FFE047] text-[#181919] font-semibold border border-transparent shadow-sm active:translate-y-px',
    secondary:
      'bg-[#2E2D39] hover:bg-[#514F66] text-white font-medium border border-transparent shadow-sm active:translate-y-px',
    outline:
      'bg-white hover:bg-[#FAFAFB] text-[#2E2D39] font-medium border border-[#E8E8EE] shadow-sm active:translate-y-px',
    danger:
      'bg-red-600 hover:bg-red-700 text-white font-medium border border-transparent shadow-sm active:translate-y-px',
    ghost:
      'bg-transparent hover:bg-[#F5F5F8] text-[#514F66] hover:text-[#2E2D39] font-medium border border-transparent',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
