import { describe, test, expect, beforeEach, vi } from 'vitest'

const mockReadFileSync = vi.fn()
const mockNunjucksConfigure = vi.fn()
const mockNunjucksCompile = vi.fn()

vi.mock('node:fs', () => ({
  default: {
    readFileSync: mockReadFileSync
  }
}))

vi.mock('nunjucks', () => ({
  default: {
    configure: mockNunjucksConfigure,
    compile: mockNunjucksCompile
  }
}))

describe('views plugin', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockNunjucksConfigure.mockReset()
    mockNunjucksCompile.mockReset()
    vi.resetModules()
  })

  describe('Context configuration', () => {
    beforeEach(() => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/javascripts/application.js': {
            file: 'assets/application-Bg4qT4NN.js',
            name: 'application',
            src: 'src/client/javascripts/application.js',
            isEntry: true
          },
          'src/client/stylesheets/application.scss': {
            file: 'assets/applicationCss-hc2psTaB.css',
            name: 'applicationCss',
            src: 'src/client/stylesheets/application.scss',
            isEntry: true
          }
        })
      )

      mockNunjucksConfigure.mockReturnValue({ addFilter: vi.fn() })
    })

    test('Should provide correct context properties', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const ctx = viewPlugin.options.context()

      expect(ctx).toEqual(
        expect.objectContaining({
          assetPath: '/public/assets',
          getAssetPath: expect.any(Function),
          serviceName: 'AICE Triage Automation'
        })
      )
    })

    test('Should provide correct assetPath in context', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const ctx = viewPlugin.options.context()

      expect(ctx.assetPath).toBe('/public/assets')
    })

    test('Should provide correct serviceName in context', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const ctx = viewPlugin.options.context()

      expect(ctx.serviceName).toBe('AICE Triage Automation')
    })

    test('Should expose cspNonce when Blankie is registered', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const mockRequest = {
        plugins: {
          blankie: {
            nonces: { script: 'sha256-abc', style: 'sha256-def' }
          }
        }
      }

      const ctx = viewPlugin.options.context(mockRequest)

      expect(ctx.cspNonce).toEqual({
        script: 'sha256-abc',
        style: 'sha256-def'
      })
    })

    test('Should have empty cspNonce when Blankie is not registered', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const mockRequest = { plugins: {} }

      const ctx = viewPlugin.options.context(mockRequest)

      expect(ctx.cspNonce).toBeUndefined()
    })

    test('Should have empty cspNonce when Blankie registered but nonces not generated', async () => {
      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      const mockRequest = { plugins: { blankie: {} } }

      const ctx = viewPlugin.options.context(mockRequest)

      expect(ctx.cspNonce).toBeUndefined()
    })
  })

  describe('Vite manifest handling', () => {
    beforeEach(() => {
      mockNunjucksConfigure.mockReturnValue({ addFilter: vi.fn() })
    })

    test('Should read vite manifest file', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/javascripts/application.js': {
            file: 'assets/application-Bg4qT4NN.js',
            name: 'application',
            src: 'src/client/javascripts/application.js',
            isEntry: true
          }
        })
      )

      await import('../../../../src/server/plugins/views.js')

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.vite/manifest.json'),
        'utf8'
      )
    })

    test('Should parse vite manifest JSON', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/javascripts/application.js': {
            file: 'assets/application-Bg4qT4NN.js',
            name: 'application',
            src: 'src/client/javascripts/application.js',
            isEntry: true
          },
          'src/client/stylesheets/application.scss': {
            file: 'assets/applicationCss-hc2psTaB.css',
            name: 'applicationCss',
            src: 'src/client/stylesheets/application.scss',
            isEntry: true
          }
        })
      )

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')

      // Test that getAssetPath uses the parsed manifest
      const ctx = viewPlugin.options.context()
      expect(ctx.getAssetPath('src/client/javascripts/application.js')).toBe(
        '/public/assets/application-Bg4qT4NN.js'
      )
    })
  })

  describe('getAssetPath function', () => {
    beforeEach(() => {
      mockNunjucksConfigure.mockReturnValue({ addFilter: vi.fn() })
    })

    test('Should return versioned asset path when asset exists in manifest', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/javascripts/application.js': {
            file: 'assets/application-Bg4qT4NN.js',
            name: 'application',
            src: 'src/client/javascripts/application.js',
            isEntry: true
          },
          'src/client/stylesheets/application.scss': {
            file: 'assets/applicationCss-hc2psTaB.css',
            name: 'applicationCss',
            src: 'src/client/stylesheets/application.scss',
            isEntry: true
          }
        })
      )

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { getAssetPath } = viewPlugin.options.context()

      expect(getAssetPath('src/client/javascripts/application.js')).toBe(
        '/public/assets/application-Bg4qT4NN.js'
      )
      expect(getAssetPath('src/client/stylesheets/application.scss')).toBe(
        '/public/assets/applicationCss-hc2psTaB.css'
      )
    })

    test('Should return original asset path when asset does not exist in manifest', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/javascripts/application.js': {
            file: 'assets/application-Bg4qT4NN.js',
            name: 'application',
            src: 'src/client/javascripts/application.js',
            isEntry: true
          }
        })
      )

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { getAssetPath } = viewPlugin.options.context()

      expect(getAssetPath('src/client/images/unknown-asset.png')).toBe(
        '/public/src/client/images/unknown-asset.png'
      )
    })

    test('Should handle empty manifest', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}))

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { getAssetPath } = viewPlugin.options.context()

      expect(getAssetPath('src/client/javascripts/any-asset.js')).toBe(
        '/public/src/client/javascripts/any-asset.js'
      )
    })

    test('Should return versioned path for defra-logo image', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'src/client/images/defra-logo.svg': {
            file: 'assets/defra-logo-abc123def.svg',
            src: 'src/client/images/defra-logo.svg'
          }
        })
      )

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { getAssetPath } = viewPlugin.options.context()

      expect(getAssetPath('src/client/images/defra-logo.svg')).toBe(
        '/public/assets/defra-logo-abc123def.svg'
      )
    })

    test('Should support backwards compatibility with string manifest values', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          'application.js': 'javascripts/application.abc123.js'
        })
      )

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { getAssetPath } = viewPlugin.options.context()

      expect(getAssetPath('application.js')).toBe(
        '/public/javascripts/application.abc123.js'
      )
    })
  })

  describe('Template compilation', () => {
    beforeEach(() => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}))
      mockNunjucksConfigure.mockReturnValue({ addFilter: vi.fn() })
    })

    test('Should compile templates with nunjucks environment', async () => {
      const mockTemplate = { render: vi.fn().mockReturnValue('<html></html>') }
      mockNunjucksCompile.mockReturnValue(mockTemplate)

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { compile } = viewPlugin.options.engines.njk

      const mockEnvironment = {}
      const compiledTemplate = compile('<html>{{ title }}</html>', {
        environment: mockEnvironment
      })

      expect(mockNunjucksCompile).toHaveBeenCalledWith(
        '<html>{{ title }}</html>',
        mockEnvironment
      )
      expect(compiledTemplate).toBeInstanceOf(Function)
    })

    test('Should render compiled template with context', async () => {
      const mockTemplate = {
        render: vi.fn().mockReturnValue('<html>Test</html>')
      }
      mockNunjucksCompile.mockReturnValue(mockTemplate)

      const { viewPlugin } =
        await import('../../../../src/server/plugins/views.js')
      const { compile } = viewPlugin.options.engines.njk

      const compiledTemplate = compile('<html>{{ title }}</html>', {
        environment: {}
      })
      const result = compiledTemplate({ title: 'Test' })

      expect(mockTemplate.render).toHaveBeenCalledWith({ title: 'Test' })
      expect(result).toBe('<html>Test</html>')
    })
  })
})
