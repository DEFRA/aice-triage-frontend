import { ecsFormat } from '@elastic/ecs-pino-format'

import { config } from '../../config/config.js'

const formatters = {
  ecs: {
    ...ecsFormat()
  },
  'pino-pretty': {
    transport: {
      target: 'pino-pretty'
    }
  }
}

const options = {
  enabled: config.get('log.enabled'),
  redact: {
    paths: config.get('log.redact'),
    remove: true
  },
  level: config.get('log.level'),
  ...formatters[config.get('log.format')],
  nesting: true
}

export {
  options
}
