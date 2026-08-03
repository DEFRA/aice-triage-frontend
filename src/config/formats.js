import isEmail from 'validator/lib/isEmail.js'
import isURL from 'validator/lib/isURL.js'
import isIP from 'validator/lib/isIP.js'

function assert (assertion, message) {
  if (!assertion) {
    throw new Error(message)
  }
}

const email = {
  name: 'email',
  coerce: (v) => v.toString(),
  validate: function (x) {
    assert(isEmail(x), 'must be an email address')
  }
}

const ipaddress = {
  name: 'ipaddress',
  coerce: (v) => v.toString(),
  validate: function (x) {
    assert(isIP(x), 'must be an IP address')
  }
}

const url = {
  name: 'url',
  coerce: (v) => v.toString(),
  validate: function (x) {
    assert(isURL(x, { require_tld: false }), 'must be a URL')
  }
}

export {
  email,
  ipaddress,
  url
}
