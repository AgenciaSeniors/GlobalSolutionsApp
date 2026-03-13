/**
 * @fileoverview Breadcrumbs — visible UI + BreadcrumbList JSON-LD schema.
 * Server component.
 * @module components/seo/Breadcrumbs
 */
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import JsonLd from './JsonLd';
import { buildBreadcrumbSchema, type BreadcrumbItem } from '@/lib/seo/jsonld';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const schema = buildBreadcrumbSchema(items);

  return (
    <>
      <JsonLd data={schema} />
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1.5 text-sm text-neutral-500 ${className}`}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isFirst = i === 0;

          return (
            <span key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />}
              {isLast ? (
                <span className="font-medium text-neutral-700 truncate max-w-[200px]">
                  {isFirst && <Home className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-brand-600 hover:underline transition-colors truncate max-w-[180px]"
                >
                  {isFirst && <Home className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
