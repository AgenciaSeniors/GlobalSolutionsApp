/** @type {import('next').NextConfig} */
import dns from 'node:dns';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const nextConfig = {
    reactStrictMode: true,

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'logos.skyscnr.com',
            },
            {
                protocol: 'https',
                hostname: 'www.gstatic.com',
                pathname: '/flights/**',
            },
        ],
    },

    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                {
                    key: 'Content-Security-Policy',
                    value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "font-src 'self' https://fonts.gstatic.com",
                        "img-src 'self' data: blob: https://*.supabase.co https://logos.skyscnr.com https://www.gstatic.com",
                        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
                        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
                        "upgrade-insecure-requests",
                    ].join('; '),
                },
            ],
        }];
    },
};

export default nextConfig;
