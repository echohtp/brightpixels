import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', timeout: 30000, expect: { timeout: 10000 },
  workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node test/server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium', launchOptions: { args: [
      '--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-vulkan=swiftshader', '--enable-features=Vulkan',
    ] } } },
    { name: 'webkit-fallback', use: { browserName: 'webkit' } },
  ],
});
