const childProcess = require('child_process')
const getPort = require('get-server-port')
const concat = require('concat-stream')
const openport = require('openport')
const isHtml = require('is-html')
const http = require('http')
const path = require('path')
const test = require('tape')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
// const Promise = require('bluebird')
// const fs = require('fs')
// const request = require('request')

const entryPath = path.join(__dirname, 'fixtures', 'index.js')
// const appJsPath = path.join(__dirname, 'fixtures', 'app.js')
// const jsSource = fs.readFileSync(appJsPath, 'utf8')

// const callServerAsync = Promise.method((server, path) => {
//   path = path || ''
//   return Promise.promisify(request)(`http://localhost:${getPort(server)}/${path}`)
// })

const createBankai = (opts, stubs) => {
  const bankai = stubs != null ? proxyquire('..', stubs) : require('..')
  return bankai(entryPath, opts)
}

test('html', (t) => {
  t.test('returns data', (t) => {
    t.plan(2)
    const assets = createBankai()
    const server = http.createServer((req, res) => {
      assets.html(req, res).pipe(res)
    })
    server.listen()

    http.get(`http://localhost:${getPort(server)}`, (res) => {
      res.pipe(concat({ string: true }, (str) => {
        t.equal(res.headers['content-type'], 'text/html')
        t.ok(isHtml(str), 'is html')
        server.close()
      }))
    })
  })
})

test('css', (t) => {
  t.test('returns data', (t) => {
    t.plan(2)
    const assets = createBankai()
    const server = http.createServer(function (req, res) {
      assets.css(req, res).pipe(res)
    })
    server.listen()

    process.nextTick(() => {
      http.get(`http://localhost:${getPort(server)}`, (res) => {
        res.pipe(concat((buf) => {
          const str = String(buf)
          t.equal(res.headers['content-type'], 'text/css')
          t.ok(/\.foo {}/.test(str), 'css is equal')
          server.close()
        }))
      })
    })
  })

  t.test('options are passed on to sheetify', (t) => {
    t.plan(1)
    const sheetify = require('sheetify/transform')
    const sheetifySpy = sinon.spy(sheetify)
    const assets = createBankai({
      css: {
        ignore: 'This is ignored'
      }
    }, {
      'sheetify/transform': sheetifySpy
    })
    assets.css().pipe(concat(() => {
      const receivedOpts = sheetifySpy.args[0][1]
      t.equal(receivedOpts.ignore, 'This is ignored', 'CSS options should be passed on to sheetify')
    }))
    //     assets._state.tinyLr = {reload: tinyLrReloadSpy}
    //     const server = http.createServer((req, res) => {
    //       assets.js(req, res).pipe(res)
    //     })
    //     server.listen()
    //
    //     // First get original bundle, then cause re-bundling and verify the latter
    //     callServerAsync(server, 'bundle.js')
    //       .then(() => {
    //         // Cause re-bundling
    //         fs.writeFileSync(appJsPath, 'const isModified = true')
    //         return waitForRebundle(t, server)
    //           .then(() => {
    //             t.ok(tinyLrReloadSpy.called, 'tiny-lr reload should be called')
    //           })
    //       })
  })
})

test('js', function (t) {
  t.test('js returns data', function (t) {
    t.plan(1)
    const assets = createBankai()
    const server = http.createServer(function (req, res) {
      assets.js(req, res).pipe(res)
    })
    server.listen()

    http.get('http://localhost:' + getPort(server), function (res) {
      res.pipe(concat(function (buf) {
        const actual = res.headers['content-type']
        const expected = 'text/javascript'
        t.equal(actual, expected, 'content type is equal')
        server.close()
      }))
    })
  })
})

test('start', function (t) {
  t.test('start does not throw', function (t) {
    t.plan(1)

    openport.find(function (err, p) {
      const port = err ? 1337 : p

      const args = ['start', './fixtures', `--port=${port}`]

      bin(args, function (error, data, child) {
        child.kill()

        if (error) {
          return t.fail(error)
        }

        const actual = data.toString().split('\n')[0]
        const expected = new RegExp(`^Started bankai for fixtures/index.js on ` +
          `http://localhost:${port}$`)
        t.ok(expected.test(actual), 'start logs success')
      })
    })
  })
})

// const waitForRebundle = (t, server) => {
//   return new Promise((resolve, reject) => {
//     let numTries = 0
//
//     const tryCall = () => {
//       ++numTries
//       callServerAsync(server, 'bundle.js')
//         .then((result) => {
//           const body = result.body
//           if (/const isModified = true/m.test(body)) {
//             t.pass('Bundle is recreated')
//             resolve()
//           } else {
//             if (numTries < 3) {
//               setTimeout(tryCall, 1000)
//             } else {
//               t.fail(`Bundle wasn't recreated on time`)
//               resolve()
//             }
//           }
//         })
//     }
//
//     setTimeout(tryCall, 300)
//   })
// }

// test('source monitoring', (t) => {
//   t.test('bundle is re-created when source files change', (t) => {
//     t.timeoutAfter(10000)
//     t.plan(2)
//
//     const assets = createBankai()
//     const tinyLrReloadSpy = sinon.spy()
//     assets._state.tinyLr = {reload: tinyLrReloadSpy}
//     const server = http.createServer((req, res) => {
//       assets.js(req, res).pipe(res)
//     })
//     server.listen()
//
//     // First get original bundle, then cause re-bundling and verify the latter
//     callServerAsync(server, 'bundle.js')
//       .then(() => {
//         // Cause re-bundling
//         fs.writeFileSync(appJsPath, 'const isModified = true')
//         return waitForRebundle(t, server)
//           .then(() => {
//             t.ok(tinyLrReloadSpy.called, 'tiny-lr reload should be called')
//           })
//       })
//       .finally(() => {
//         fs.writeFileSync(appJsPath, jsSource)
//         server.close()
//       })
//   })
// })

test('__END__', function (t) {
  t.on('end', function () {
    setTimeout(function () {
      process.exit(0)
    }, 100)
  })
  t.end()
})

const bin = (args, cb) => {
  const file = path.resolve(__dirname, '../bin.js')

  const child = childProcess.spawn(file, args, {
    cwd: __dirname,
    env: process.env
  })

  child.stdout.once('data', function (data) {
    cb(null, data, child)
  })

  child.stderr.once('data', function (error) {
    cb(new Error(error), null, child)
  })
}
