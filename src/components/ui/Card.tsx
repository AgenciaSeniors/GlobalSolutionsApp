/**
 * @fileoverview Multi-variant Card wrapper.
 * @module components/ui/Card
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variants = {
  default:
    "bg-white rounded-2xl p-6",

  bordered:
    "bg-white rounded-2xl p-6 border border-brand-100",

  elevated:
    "bg-white rounded-2xl p-6 border border-brand-100 " +
    "shadow-sm hover:shadow-md transition-all duration-200 " +
    "hover:-translate-y-[2px]",
} as const;


export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => (
    <div ref={ref} className={cn(variants[variant], className)} {...props}>
      {children}
    </div>
  ),
);

Card.displayName = 'Card';
export default Card;
