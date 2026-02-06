/**
 * @fileoverview Skeleton shimmer placeholder for loading states.
 * @module components/ui/Skeleton
 */
import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-neutral-200 animate-pulse',
        className,
      )}
    />
  );
}
