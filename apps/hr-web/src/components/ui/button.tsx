/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-sans text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'lumina-gradient text-primary-foreground shadow-[0_4px_14px_rgba(0,108,73,0.18)] hover:shadow-[0_8px_22px_rgba(0,108,73,0.22)]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-[#bbcabf] bg-white text-[#0b1c30] hover:bg-[#eff4ff] hover:text-[#006c49]',
        secondary: 'bg-[#4648d4] text-white hover:bg-[#393bb7]',
        ghost: 'text-[#3c4a42] hover:bg-[#eff4ff] hover:text-[#006c49]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-12 rounded-lg px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  children: React.ReactNode;
}

/**
 * Reusable button component with variants and sizes.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    if (asChild) {
      const child = React.Children.only(children);

      if (React.isValidElement<{ className?: string }>(child)) {
        return React.cloneElement(child, {
          ...props,
          className: cn(buttonVariants({ variant, size, className }), child.props.className),
        } as React.HTMLAttributes<HTMLElement>);
      }
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
