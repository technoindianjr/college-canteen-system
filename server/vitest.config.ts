import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'mysql://canteen:canteen@127.0.0.1:3306/canteen_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      AUTH_DEV_MODE: 'true',
      ADMIN_PHONES: '+910000000001',
      UPLOAD_DIR: './.test-uploads',
      FIREBASE_SERVICE_ACCOUNT_PATH: '',
    },
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
