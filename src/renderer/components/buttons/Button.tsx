import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gradient' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const variants: Record<string, string> = {
  primary: 'bg-[var(--ft-accent)] text-white hover:brightness-110 shadow-[0_0_0_1px_rgba(124,92,255,0.4)]',
  // Reserved for the single most important action on a screen (Apply, Apply All, Turn On).
  gradient: 'ft-btn-gradient',
  secondary:
    'bg-[var(--ft-surface-raised)] text-[var(--ft-text-primary)] border border-[var(--ft-border)] hover:border-[var(--ft-border-hover)]',
  danger:
    'bg-[var(--ft-danger-soft)] text-[var(--ft-danger)] border border-[rgba(248,85,95,0.3)] hover:bg-[rgba(248,85,95,0.18)]',
  ghost: 'bg-transparent text-[var(--ft-text-secondary)] hover:text-[var(--ft-text-primary)] hover:bg-[var(--ft-surface-raised)]',
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'no-drag inline-flex items-center justify-center gap-1.5 rounded-[var(--ft-radius-pill)] font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'text-xs px-3.5 py-1.5' : 'text-sm px-4.5 py-2',
        variants[variant],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
