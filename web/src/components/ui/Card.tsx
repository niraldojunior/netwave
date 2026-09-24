import React, { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  noPadding?: boolean;
}

export default function Card({
  title,
  subtitle,
  actions,
  children,
  noPadding = false,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div className={`vt-card ${className}`} {...rest}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8EE]">
          <div>
            {title && <h3 className="text-sm font-semibold text-[#2E2D39]">{title}</h3>}
            {subtitle && <p className="text-xs text-[#8A8899] mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}
