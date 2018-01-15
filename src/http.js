const http = require('http')

exports.request = (config, data) => {
  return new Promise((resolve, reject) => {
    const req = http.request(config, res => {
      res.setEncoding('utf8')

      if (res.statusCode === 204) {
        return resolve()
      }

      let body = ''
      res.on('data', chunk => {
        body += chunk
      })

      res.on('end', () => {
        const response =
          res.headers['content-type'] === 'application/json' ? JSON.parse(body) : body

        if (res.statusCode < 300) {
          resolve(response)
        } else {
          reject(new Error(response.error))
        }
      })
    })

    req.on('error', reject)
    req.end(data)
  })
}
