import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

const variants: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white active:bg-teal-700 shadow-lg',
  secondary: 'bg-white text-teal-700 border-2 border-teal-600 active:bg-teal-50',
  danger: 'bg-rose-600 text-white active:bg-rose-700 shadow-lg',
  success: 'bg-emerald-600 text-white active:bg-emerald-700 shadow-lg',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
  subtitle?: string;
  iconSide?: 'top' | 'right';
  labelClassName?: string;
  iconClassName?: string;
};

export function BigButton({
  children,
  variant = 'primary',
  icon,
  subtitle,
  iconSide = 'top',
  labelClassName = '',
  iconClassName = '',
  className = '',
  ...props
}: Props) {
  const isIconRight = iconSide === 'right';

  return (
    <button
      type="button"
      className={`parent-touch w-full rounded-2xl px-6 py-5 font-semibold flex flex-col items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      <div
        className={`flex w-full items-center ${isIconRight ? 'flex-row justify-between gap-4' : 'flex-col justify-center gap-2'}`}
      >
        <span className={`min-w-0 break-words ${labelClassName}`}>{children}</span>
        {icon && (
          <span className={`${isIconRight ? 'text-2xl' : 'text-3xl'} ${iconClassName}`}>
            {icon}
          </span>
        )}
      </div>
      {subtitle && (
        <span className="text-sm font-normal opacity-90">{subtitle}</span>
      )}
    </button>
  );
}
