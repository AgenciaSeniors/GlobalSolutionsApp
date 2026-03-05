import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.globalsolutions.travel',
  appName: 'Global Solutions Travel',
  webDir: 'out',
  server: {
    // Modo WebView remoto: la APK carga el sitio en produccion.
    url: 'https://globalsolutiontravel.com',
    cleartext: false,
    // Permite que supabase se abra DENTRO de la app
    allowNavigation: ['*.supabase.co'],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: 'TU_WEB_CLIENT_ID.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;