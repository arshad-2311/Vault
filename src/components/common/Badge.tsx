import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-zinc-850 text-zinc-200 border border-zinc-700',
    warning: 'bg-red-950/80 text-red-400 border border-red-800/60',
    danger: 'bg-red-950/90 text-red-400 border border-red-800/80',
    info: 'bg-zinc-850 text-zinc-300 border border-zinc-700',
    neutral: 'bg-zinc-900 text-zinc-400 border border-zinc-800',
    purple: 'bg-zinc-850 text-zinc-300 border border-zinc-700',
  };

  const sizeStyles = {
    sm: 'text-2xs px-2 py-0.5 rounded',
    md: 'text-xs px-2.5 py-1 rounded-md font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium tracking-wide ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
