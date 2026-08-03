import * as IORedis from 'ioredis'

import { createLogger } from './logging/logger.js'
import { buildErrorLog } from './logging/utils/build-error-log.js'

/**
 * Setup Redis and provide a redis client
 *
 * Local development - 1 Redis instance
 * Environments - Elasticache / Redis Cluster with username and password
 */
function buildRedisClient (redisConfig) {
  const logger = createLogger()
  const port = 6379
  const db = 0
  const keyPrefix = redisConfig.keyPrefix
  const host = redisConfig.host
  let redisClient

  const credentials =
    redisConfig.username === ''
      ? {}
      : {
          username: redisConfig.username,
          password: redisConfig.password
        }

  const tls = redisConfig.useTLS ? { tls: {} } : {}

  if (redisConfig.useSingleInstanceCache) {
    redisClient = new IORedis.Redis({
      port,
      host,
      db,
      keyPrefix,
      ...credentials,
      ...tls
    })
  } else {
    redisClient = new IORedis.Cluster(
      [
        {
          host,
          port
        }
      ],
      {
        keyPrefix,
        slotsRefreshTimeout: 10000,
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
          db,
          ...credentials,
          ...tls
        }
      }
    )
  }

  redisClient.on('connect', () => {
    logger.info('Connected to Redis server')
  })

  redisClient.on('error', (error) => {
    logger.error(buildErrorLog(error, { type: 'redis_connection_error' }), 'Redis connection error')
  })

  return redisClient
}

export {
  buildRedisClient
}
