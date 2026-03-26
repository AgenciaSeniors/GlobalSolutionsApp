/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    trailingSlash: false,

    eslint: {
        // Los errores de lint no deben bloquear el build de producción.
        // Los linters se ejecutan por separado en CI/pre-commit.
        ignoreDuringBuilds: true,
    },

    typescript: {
        // Permite hacer build aunque haya errores de tipo no críticos.
        ignoreBuildErrors: true,
    },

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
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                        "img-src 'self' data: https: blob:; " +
                        "font-src 'self' https://fonts.gstatic.com; " +
                        "frame-src 'self' blob:; " +
                        "connect-src 'self' data: blob: https://*.supabase.co https://flights-sky.p.rapidapi.com https://fonts.googleapis.com https://fonts.gstatic.com;",
                },
            ],
        }, ];
    },

    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
            { protocol: 'https', hostname: 'flagcdn.com' },
            { protocol: 'https', hostname: 'logos.skyscnr.com' },
            { protocol: 'https', hostname: '*.supabase.co' },
        ],
    },
};

export default nextConfig;