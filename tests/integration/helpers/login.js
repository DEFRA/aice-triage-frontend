/**
 * Logs an integration-test request in via the 'local' auth provider's dev
 * session shortcut (see `pages/login/controller.js` and
 * `pages/login/mock-user.js`) - no OAuth round-trip, no Entra fixtures
 * required.
 *
 * Only meaningful while `AUTH_PROVIDER` is 'local' (the test default, see
 * `vitest.setup.js`) - hitting this route under the 'entra' provider would
 * hit the real Bell-authenticated branch and fail, since no genuine OAuth
 * callback was performed.
 *
 * @param {import('@hapi/hapi').Server} server
 * @returns {Promise<string>} a `Cookie` header value carrying the
 * authenticated session, for use in subsequent `server.inject` calls
 */
async function loginAsDevUser (server) {
  const response = await server.inject({
    method: 'GET',
    url: '/login/callback'
  })

  const cookies = response.headers['set-cookie'] ?? []

  return cookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

export { loginAsDevUser }
