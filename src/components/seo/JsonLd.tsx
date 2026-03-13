/**
 * @fileoverview JSON-LD renderer — injects structured data into the page.
 * Server component. Next.js 14 hoists the script to <head>.
 * @module components/seo/JsonLd
 */

interface JsonLdProps {
  /** A single Schema.org object or an array of objects */
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data];

  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
