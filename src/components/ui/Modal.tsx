//src/components/ui/Modal.tsx
/**
 * @fileoverview Accessible modal dialog with backdrop click-to-close,
 *               Escape key handling, and focus trap.
 * @module components/ui/Modal
 */
'use client';

import { useEffect, useCallback, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

export default function Modal({ open, onClose, children, className, title }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const lastActiveRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('data-modal-ignore'));

      if (focusables.length === 0) {
        e.preventDefault();
        closeBtnRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus first focusable element (or close button)
    queueMicrotask(() => {
      const panel = panelRef.current;
      const focusables = panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

      (focusables[0] ?? closeBtnRef.current)?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      lastActiveRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Modal'}
    >
      <div
        ref={panelRef}
        className={cn('relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-fade-in-up', className)}
      >
        {title ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : null}

        <button
          ref={closeBtnRef}
          data-modal-ignore
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {children}
      </div>
    </div>
  );
}
