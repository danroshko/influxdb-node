const http = require('./http')

class Influx {
  constructor (config = {}) {
    this._configureDB(config.database)
    this._configureRP(config.retentionPolicy)
    this._configureBuffer(config.buffer)

    this._writeConfig = {
      path: `/write?db=${this.db.name}&rp=${this.rp.name}&precision=ms`,
      method: 'POST',
      host: this.db.host,
      port: this.db.port
    }

    this.ready = this._initDatabase()
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
      host: this.db.host,
      port: this.db.port
    })
  }

  /**
   * Query data from InfluxDB
   * https://docs.influxdata.com/influxdb/v1.4/query_language/data_exploration
   * @param {string} query SELECT statement
   * @param {boolean} [format] transform response from InfluxDB format to array of objects
   */
  async query (query, format = true) {
    const config = {
      path: '/query?' + encodeURI(`db=${this.db.name}&epoch=ms&q=` + query),
      method: 'GET',
      host: this.db.host,
      port: this.db.port
    }

    const response = await http.request(config)

    if (response.error) {
      throw new Error(response.error)
    }

    return this.formatQueryResponse(response, format)
  }

  /**
   * Covert response from overly verbose InfluxDB format to array of objects
   * @param {object} response response from InfluxDB
   * @param {boolean} [format]
   */
  formatQueryResponse (response, format = true) {
    const result = response.results[0]
    if (!result.series) return []

    const series = result.series[0]
    if (!format) return series

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

  _configureDB (config = {}) {
    const defaultConfig = {
      name: 'test',
      host: '127.0.0.1',
      port: 8086
    }

    this.db = { ...defaultConfig, ...config }
  }

  _configureRP (config = {}) {
    const defaultConfig = {
      name: 'test',
      duration: 'INF',
      replication: 1,
      shardDuration: null,
      default: true
    }

    this.rp = { ...defaultConfig, ...config }
  }

  _configureBuffer (config = {}) {
    this.buffer = []
    this.maxBufferSize = config.maxSize || 100
    this.maxBufferTime = config.maxTime || 1000
    this.nextFlush = null
  }

  async _initDatabase () {
    await this._createDatabase()
    return this._createRetentionPolicy()
  }

  _createDatabase () {
    return this.execute(`CREATE DATABASE "${this.db.name}"`)
  }

  _createRetentionPolicy () {
    let query = `
      CREATE RETENTION POLICY "${this.rp.name}"
      ON "${this.db.name}"
      DURATION ${this.rp.duration}
      REPLICATION ${this.rp.replication}`

    if (this.rp.shardDuration) {
      query += ` SHARD DURATION ${this.rp.shardDuration}`
    }

    if (this.rp.default) {
      query += ' DEFAULT'
    }

    return this.execute(query)
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
