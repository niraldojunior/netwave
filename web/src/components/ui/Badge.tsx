import React, { type CSSProperties, type HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'brand' | 'ink';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--surface-muted, #f5f5f8)', fg: 'var(--text-secondary, #514f66)' },
  green: { bg: 'rgba(16, 185, 129, 0.12)', fg: '#059669' },
  blue: { bg: 'rgba(59, 130, 246, 0.12)', fg: '#2563eb' },
  amber: { bg: 'rgba(245, 158, 11, 0.12)', fg: '#d97706' },
  red: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#dc2626' },
  purple: { bg: 'rgba(147, 51, 234, 0.12)', fg: '#7c3aed' },
  brand: { bg: 'rgba(255, 217, 25, 0.15)', fg: '#856404' },
  ink: { bg: 'var(--surface-ink, #2e2d39)', fg: '#ffd919' },
};

export default function Badge({ children, tone = 'neutral', dot = false, style, ...rest }: BadgeProps) {
  const t = TONES[tone] || TONES.neutral;
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: '4px',
    background: t.bg,
    color: t.fg,
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
  return (
    <span style={{ ...base, ...style }} {...rest}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}
