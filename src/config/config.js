import path from 'node:path'
import url from 'node:url'

import convict from 'convict'

import * as formats from './formats.js'

const dirname = path.dirname(url.fileURLToPath(import.meta.url))

const fourHoursMs = 14400000
const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(formats)

const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'AICE Triage Automation'
  },
  triageApiUrl: {
    doc: 'Base URL for the triage backend API',
    format: 'url',
    default: null,
    env: 'TRIAGE_API_URL'
  },
  triageApiTimeoutMs: {
    doc: 'Timeout in milliseconds for requests to the triage backend API. Scoring requests can take longer than simple reads, so this needs to comfortably cover LLM-backed scoring calls.',
    format: Number,
    default: 15000,
    env: 'TRIAGE_API_TIMEOUT_MS'
  },
  jira: {
    baseUrl: {
      doc: 'Base URL for the Jira instance used to build create-issue links',
      format: 'url',
      default: null,
      nullable: !isProduction,
      env: 'JIRA_BASE_URL'
    },
    projectId: {
      doc: 'Jira numeric project ID used in create-issue links (not the project key)',
      format: String,
      default: null,
      nullable: !isProduction,
      env: 'JIRA_PROJECT_ID'
    },
    issueTypeId: {
      doc: 'Jira numeric issue type ID used in create-issue links',
      format: String,
      default: null,
      nullable: !isProduction,
      env: 'JIRA_ISSUE_TYPE_ID'
    }
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  auth: {
    provider: {
      doc: 'Authentication provider to use',
      format: isProduction ? ['entra'] : ['entra', 'local'],
      default: 'entra',
      env: 'AUTH_PROVIDER'
    },
    entra: {
      tenantId: {
        doc: 'Entra ID (Azure AD) tenant ID (GUID) that issues tokens for this app registration',
        format: String,
        default: null,
        nullable: !isProduction,
        env: 'ENTRA_TENANT_ID'
      },
      clientId: {
        doc: 'Entra ID application (client) ID registered for this portal',
        format: String,
        default: null,
        nullable: !isProduction,
        env: 'ENTRA_CLIENT_ID'
      },
      clientSecret: {
        doc: 'Entra ID application client secret',
        format: String,
        default: null,
        nullable: !isProduction,
        env: 'ENTRA_CLIENT_SECRET',
        sensitive: true
      },
      authorityHost: {
        doc: 'Entra authority host used to build the authorize/token/JWKS endpoints',
        format: String,
        default: 'https://login.microsoftonline.com',
        env: 'ENTRA_AUTHORITY_HOST'
      },
      redirectHost: {
        doc: 'Entra redirect host used to build the redirect URI for the OIDC flow, e.g. http://localhost:3000',
        format: String,
        default: null,
        nullable: !isProduction,
        env: 'ENTRA_REDIRECT_HOST'
      },
      useRefreshTokens: {
        doc: 'Toggle whether to refresh tokens on expiration. If false, the user will be logged out when the access token expires.',
        format: Boolean,
        default: false,
        env: 'ENTRA_USE_REFRESH_TOKENS'
      },
      refreshTokenAquisitionTimeout: {
        doc: 'Timeout in milliseconds for acquiring a new access token using the refresh token.',
        format: Number,
        default: 5000,
        env: 'ENTRA_REFRESH_TOKEN_ACQUISITION_TIMEOUT'
      }
    }
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: fourHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: null,
      nullable: process.env.NODE_ENV !== 'production',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      sensitive: true,
      default: null,
      nullable: process.env.NODE_ENV !== 'production',
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'aice-triage-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }
