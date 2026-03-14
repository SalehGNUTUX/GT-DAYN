import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:    'com.gtdayn.app',
  appName:  'GT-DAYN',
  webDir:   'dist',                 // مخرجات Vite
  bundledWebRuntime: false,

  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation:    'Library/CapacitorDatabase',
      iosIsEncryption:        false,
      iosKeychainPrefix:      'GTDayn',
      androidIsEncryption:    false,
      electronIsEncryption:   false,
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases',
      electronMacLocation:    '/Users/Shared/CapacitorDatabases',
      electronLinuxLocation:  'Databases',
    },
  },

  android: {
    allowMixedContent: false,
    backgroundColor:   '#f0f4f8',
    // تفعيل Edge-to-Edge على Android 15+
    windowSoftInputMode: 'adjustResize',
  },

  server: {
    androidScheme: 'https',
  },
};

export default config;
