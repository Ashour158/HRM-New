import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Input component with standard styling.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-transparent bg-[#f1f5f9] px-3 py-2 text-sm text-[#0f172a] ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#94a3b8] focus-visible:border-[#4f46e5] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]/20 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
