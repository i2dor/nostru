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
  },
  vite: () => ({
    resolve: {
      alias: {
        tseep: 'eventemitter3',
      },
    },
  }),
});
