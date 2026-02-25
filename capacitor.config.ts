import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.globalsolutions.travel',
  appName: 'Global Solutions Travel',
  webDir: 'out',
  server: {
    // Modo WebView remoto: la APK carga el sitio en produccion.
    // No requiere exportar Next.js como estatico.
    url: 'https://globalsolutiontravel.com',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Permite que supabase.co se abra DENTRO del WebView (magic link de auth callback).
    // Sin esto, Capacitor abre dominios externos en Chrome del sistema.
    allowNavigation: ['*.supabase.co'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      // Usar el mismo color de fondo que la web para evitar flicker.
      // Actualizar si el color primario de la web cambia.
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // ⚠️ Reemplazar con el Web Client ID de Google Cloud Console.
      // Debe ser el client ID de tipo "Web application", NO el de Android.
      // Se usa para validar el idToken en Supabase.
      serverClientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
