import pino from 'pino'

import { options as loggerOptions } from './options.js'

const logger = pino(loggerOptions)

function createLogger () {
  return logger
}

export {
  createLogger
}
