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
      disableBackButtonHandler: true,
    },
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
      autoBackdropColor: 'dom',
    },
  },
};

export default config;
