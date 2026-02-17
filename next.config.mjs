/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false, // Oculta que usamos Next.js (seguridad por oscuridad básica)

    // Headers de seguridad HTTP estrictos
    async headers() {
        return [{
            source: '/(.*)',
            headers: [{
                    key: 'X-Content-Type-Options',
                    value: 'nosniff',
                },
                {
                    key: 'X-Frame-Options',
                    value: 'DENY', // Evita que tu web sea metida en un iframe (Clickjacking)
                },
                {
                    key: 'X-XSS-Protection',
                    value: '1; mode=block',
                },
                {
                    key: 'Referrer-Policy',
                    value: 'strict-origin-when-cross-origin',
                },
                {
                    key: 'Strict-Transport-Security',
                    value: 'max-age=63072000; includeSubDomains; preload', // Fuerza HTTPS por 2 años
                },
                // CSP Básico (Content Security Policy)
                // Nota: 'unsafe-eval' y 'unsafe-inline' se permiten solo donde es estrictamente necesario por librerías externas
                {
                    key: 'Content-Security-Policy',
                    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://www.paypal.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.stripe.com https://www.paypal.com https://*.supabase.co https://flights-sky.p.rapidapi.com;",
                }
            ],
        }, ];
    },

    images: {
        remotePatterns: [{
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com', // Avatares de Google
            },
            {
                protocol: 'https',
                hostname: 'flagcdn.com', // Banderas de países
            },
            {
                protocol: 'https',
                hostname: 'logos.skyscnr.com', // Logos de aerolíneas
            }
        ],
    },
};

export default nextConfig;