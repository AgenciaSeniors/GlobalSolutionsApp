/**
 * @fileoverview Full-page loading component with centered spinner.
 * Use this in dashboard pages to show a polished loading state
 * while data is being fetched.
 * @module components/ui/PageLoader
 */
'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PageLoaderProps {
  message?: string;
  className?: string;
}

export default function PageLoader({
  message = 'Cargando...',
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-24 gap-4',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      <p className="text-sm text-neutral-500 font-medium animate-pulse">
        {message}
      </p>
    </div>
  );
}
