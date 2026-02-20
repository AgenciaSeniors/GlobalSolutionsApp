/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,

    experimental: {
        serverComponentsExternalPackages: ['pino', 'pino-pretty'],
    },

    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-XSS-Protection', value: '1; mode=block' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                {
                    key: 'Content-Security-Policy',
                    value: "default-src 'self'; " +
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://www.paypal.com https://www.sandbox.paypal.com; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                        "img-src 'self' data: https: blob:; " +
                        "font-src 'self' https://fonts.gstatic.com; " +
                        /* 🚨 AQUÍ ESTÁ EL FIX: Añadimos 'self' y blob: al frame-src */
                        "frame-src 'self' blob: https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://www.sandbox.paypal.com; " +
                        /* 🚨 AQUÍ ESTÁ EL FIX: Añadimos data: al connect-src */
                        "connect-src 'self' data: https://api.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://*.supabase.co https://flights-sky.p.rapidapi.com;",
                },
            ],
        }, ];
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'flagcdn.com' },
            { protocol: 'https', hostname: 'logos.skyscnr.com' },
        ],
    },
};

export default nextConfig;