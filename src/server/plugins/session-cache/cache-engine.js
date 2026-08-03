import * as CatboxRedis from '@hapi/catbox-redis'
import * as CatboxMemory from '@hapi/catbox-memory'

import { createLogger } from '../../../infra/logging/logger.js'
import { buildRedisClient } from '../../../infra/redis-client.js'
import { config } from '../../../config/config.js'

function getCacheEngine (engine) {
  const logger = createLogger()

  if (engine === 'redis') {
    logger.info('Using Redis session cache')
    const redisClient = buildRedisClient(config.get('redis'))
    return new CatboxRedis.Engine({ client: redisClient })
  }

  if (config.get('isProduction')) {
    logger.error(
      'Catbox Memory is for local development only, it should not be used in production!'
    )
  }

  logger.info('Using Catbox Memory session cache')
  return new CatboxMemory.Engine()
}

export {
  getCacheEngine
}
