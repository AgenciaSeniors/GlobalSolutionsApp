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
  },
};

export default config;
