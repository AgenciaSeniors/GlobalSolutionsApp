/**
 * @fileoverview Toast notification provider using sonner.
 * @module components/providers/ToastProvider
 */
'use client';

import { Toaster } from 'sonner';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        className: 'font-sans',
        duration: 4000,
      }}
    />
  );
}
