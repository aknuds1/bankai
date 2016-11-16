const watchifyRequest = require('watchify-request')
const sheetify = require('sheetify/transform')
const cssExtract = require('css-extract')
const createHtml = require('create-html')
const browserify = require('browserify')
const concat = require('concat-stream')
const watchify = require('watchify')
const assert = require('assert')
const stream = require('stream')
const xtend = require('xtend')
const from = require('from2')
const pump = require('pump')
const logger = require('bole')('bankai')

module.exports = Bankai

// (str, obj) -> obj
function Bankai (entry, opts) {
  if (!(this instanceof Bankai)) return new Bankai(entry, opts)

  opts = opts || {}

  assert.equal(typeof entry, 'string', 'bankai: entry should be a string')
  assert.equal(typeof opts, 'object', 'bankai: opts should be an object')

  this.optimize = opts.optimize
  this.htmlDisabled = opts.html
  this.cssDisabled = opts.css
  this.cssQueue = []

  this._html = _html(opts.html)
  this._createJs = _javascript(entry, opts.js, (css) => {
    this._css = css
    while (this.cssQueue.length) {
      this.cssQueue.shift()()
    }
  })
}

// (obj, obj) -> readStream
Bankai.prototype.js = function (req, res) {
  const through$ = new stream.PassThrough()
  this._createJs(req, res, (err, buffer) => {
    if (err) {
      return through$.emit('error', err)
    }
    const source$ = from([buffer])
    pump(source$, through$)
  })
  return through$
}

// (obj, obj) -> readStream
Bankai.prototype.html = function (req, res) {
  assert.ok(this.htmlDisabled !== false, 'bankai: html is disabled')
  if (res) {
    res.setHeader('Content-Type', 'text/html')
  }
  return from([this._html])
}

// (obj, obj) -> readStream
Bankai.prototype.css = function (req, res) {
  assert.ok(this.cssDisabled !== false, 'bankai: css is disabled')
  if (res) {
    res.setHeader('Content-Type', 'text/css')
  }
  if (!this._css) {
    logger.debug(`Waiting for CSS content to be done`)
    const through = new stream.PassThrough()
    this.cssQueue.push(() => {
      logger.debug(`CSS content is finished, pumping it out: '${this._css}'`)
      pump(from([this._css]), through)
    })
    return through
  } else {
    logger.debug(`Returning CSS content: '${this._css}'`)
    return from([this._css])
  }
}

const _html = (opts) => {
  const base = {
    script: 'bundle.js',
    css: 'bundle.css',
    head: '<meta name="viewport" content="width=device-width, initial-scale=1">'
  }
  const html = createHtml(xtend(base, opts || {}))
  return new Buffer(html)
}

// create a js watcher
const _javascript = (entry, opts, setCss) => {
  const base = {
    basedir: process.cwd(),
    entries: [ entry ],
    packageCache: {},
    fullPaths: true,
    cache: {}
  }

  opts = xtend(base, opts || {})

  const b = (this.optimize)
    ? browserify(opts)
    : watchify(browserify(opts))
  b.plugin(cssExtract, { out: createCssStream })
  b.transform(sheetify)

  return watchifyRequest(b)

  function createCssStream () {
    return concat({ encoding: 'buffer' }, setCss)
  }
}
