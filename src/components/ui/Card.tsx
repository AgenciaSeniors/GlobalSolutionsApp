/**
 * @fileoverview Multi-variant Card wrapper.
 * @module components/ui/Card
 */
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const variants = {
  default: 'bg-white rounded-2xl p-6',
  bordered: 'bg-white rounded-2xl p-6 border border-neutral-200',
  elevated:
    'bg-white rounded-2xl p-6 shadow-lg shadow-black/[0.04] hover:shadow-xl transition-shadow duration-300',
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
