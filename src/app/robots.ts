/**
 * @fileoverview robots.txt — crawl directives for search engines.
 * @module app/robots
 */
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://globalsolutiontravel.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/flights/search',
          '/checkout/',
          '/pay/',
          '/user/',
          '/admin/',
          '/agent/',
          '/login',
          '/register',
          '/forgot-password',
          '/update-password',
          '/auth/',
          '/dev/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
