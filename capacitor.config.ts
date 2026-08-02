import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.divyansh.setu',
  appName: 'Setu',
  webDir: 'dist',
  backgroundColor: '#f0fdfa',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    App: {
      disableBackButtonHandler: false,
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: false,
      autoBackdropColor: 'dom',
    },
  },
};

export default config;
