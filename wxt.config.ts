import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  manifest: {
    name: 'Nostru',
    description: 'Nostr social client for your browser',
    permissions: ['storage', 'sidePanel'],
    action: {},
  },
  vite: () => ({
    resolve: {
      alias: {
        tseep: 'eventemitter3',
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
  }),
});
