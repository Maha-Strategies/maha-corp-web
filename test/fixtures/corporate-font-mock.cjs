// Local browser tests only; avoid external Google Font requests.
module.exports = new Proxy({}, { get(_target, url) {
  const family = new URL(url).searchParams.get('family').split(':')[0]
  return `@font-face { font-family: '${family}'; src: local('Arial'); font-weight: 100 900; font-style: normal; }`
} })
