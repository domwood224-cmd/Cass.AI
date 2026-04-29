import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.cassidey.app',
  appName: 'cassidey',
  webDir: 'dist',
  android: {
    backgroundColor: '#050505',
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#050505',
    },
  },
};

export default config;
