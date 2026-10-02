import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kingofwordor.game',
  appName: 'King of Wordor',
  webDir: 'dist',
  android: {
    // The dictionary is a bundled local asset; the game never needs the network
    // to validate a word (brief requirement #4).
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1d1207',
      androidSplashResourceName: 'splash',
    },
    Keyboard: { resizeOnFullScreen: true },
  },
};

export default config;
