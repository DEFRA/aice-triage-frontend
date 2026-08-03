import process from 'node:process'

import { createServer, startServer } from './server/server.js'
import { createLogger } from './infra/logging/logger.js'
import { buildErrorLog } from './infra/logging/utils/build-error-log.js'

const server = await createServer()

await startServer(server)

process.on('unhandledRejection', (error) => {
  const logger = createLogger()

  logger.error(buildErrorLog(error, { type: 'unhandled_rejection' }), 'Unhandled rejection')

  process.exitCode = 1
})
