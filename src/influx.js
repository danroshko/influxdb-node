const http = require('./http')

class Influx {
  /**
   * Create new InfluxDB client
   * @param {object} [config]
   * @param {string} [config.db=test] database for writes
   * @param {string} [config.rp=autogen] retention policy
   * @param {string} [config.host="127.0.0.1"]
   * @param {number} [config.port=8086]
   * @param {number} [config.maxBufferSize=100] naximum number of buffered writes
   * @param {number} [config.maxBufferTime=1000] maximum number of ms to buffer writes
   */
  constructor (config = {}) {
    this.db = config.db || 'test'
    this.rp = config.rp || 'autogen'

    this.host = config.host || '127.0.0.1'
    this.port = config.port || 8086

    this.maxBufferSize = config.maxBufferSize || 100
    this.maxBufferTime = config.maxBufferTime || 1000

    this.buffer = []
    this.nextFlush = null

    this._writeConfig = {
      path: `/write?db=${this.db}&rp=${this.rp}&precision=ms`,
      method: 'POST',
      host: this.host,
      port: this.port
    }
  }

  /**
   * Add point to the buffer
   * https://docs.influxdata.com/influxdb/v1.4/write_protocols/line_protocol_reference/
   * @param {string} data point in the line protocol format
   */
  write (data) {
    this.buffer.push(data + ' ' + Date.now())

    if (this.buffer.length > this.maxBufferSize) {
      return this._flushBuffer()
    }

    if (!this.nextFlush) {
      this.nextFlush = setTimeout(() => this._flushBuffer(), this.maxBufferTime)
    }
  }

  /**
   * Write point immediately to InfluxDB without buffering
   * @param {string} data point in the line protocol format
   */
  writeImmediate (data) {
    return http.request(this._writeConfig, data)
  }

  /**
   * Run arbitrary InfluxDB query
   * https://docs.influxdata.com/influxdb/v1.4/query_language/schema_exploration/
   * https://docs.influxdata.com/influxdb/v1.4/query_language/database_management/
   * @param {string} query query to execute
   */
  async execute (query) {
    return http.request({
      path: '/query?q=' + encodeURIComponent(query),
      method: 'GET',
      host: this.host,
      port: this.port
    })
  }

  /**
   * Query data from InfluxDB
   * https://docs.influxdata.com/influxdb/v1.4/query_language/data_exploration
   * @param {string} query SELECT statement
   * @param {boolean} [convert=true] transform response from InfluxDB format to an array of objects
   */
  async query (query, convert = true) {
    const config = {
      path: '/query?' + encodeURI(`db=${this.db}&epoch=ms&q=` + query),
      method: 'GET',
      host: this.host,
      port: this.port
    }

    const response = await http.request(config)

    if (response.error) {
      throw new Error(response.error)
    }

    return this.formatQueryResponse(response, convert)
  }

  /**
   * Covert response from InfluxDB format to an array of objects
   * @param {object} response response from InfluxDB
   * @param {boolean} [convert=true]
   */
  formatQueryResponse (response, convert = true) {
    const result = response.results[0]
    if (!result.series) return []

    const series = result.series[0]
    if (!convert) return series

    const { columns } = series
    if (!columns || !columns.length) return []

    return series.values.map(row => {
      const obj = {}

      columns.forEach((name, index) => {
        obj[name] = row[index]
      })

      return obj
    })
  }

  _flushBuffer () {
    const data = this.buffer.join('\n')

    this.buffer = []
    clearTimeout(this.nextFlush)
    this.nextFlush = null

    http.request(this._writeConfig, data).catch(err => this.onError(err))
  }

  onError (error) {
    console.error(error)
  }
}

module.exports = Influx
