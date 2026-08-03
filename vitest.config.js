import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      ...configDefaults.coverage,
      reportOnFailure: true,
      clean: false,
      reportsDirectory: 'coverage',
      reporter: ['lcov'],
      include: ['src/**/*.js'],
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '.server',
        'src/index.js'
      ]
    }
  }
})
