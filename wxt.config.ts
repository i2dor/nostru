import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  manifest: {
    name: 'Nostru',
    description: 'Nostr identity. Bitcoin Silent Payments. One key.',
    permissions: ['storage', 'sidePanel', 'windows', 'notifications', 'alarms', 'nativeMessaging'],
    host_permissions: ['https://*/*'],
    action: {},
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        tseep: 'eventemitter3',
      },
    },
  }),
});
