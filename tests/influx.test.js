/* global test, expect */
const Influx = require('../index')

test('default config', async () => {
  const influx = new Influx()
  return influx.ready
})

test('full config', async () => {
  const influx = new Influx({
    database: {
      name: 'mydb',
      host: '127.0.0.1',
      port: 8086
    },
    retentionPolicy: {
      name: 'two_weeks',
      duration: '2w',
      replication: 1,
      shardDuration: '1h',
      default: true
    },
    buffer: {
      maxSize: 1000,
      maxTime: 1000
    }
  })

  return influx.ready
})

test('writes', async () => {
  const influx = new Influx()
  await influx.ready

  influx.write('cpu,server=server1 value=0.22')
  influx.write('cpu,server=server2 value=0.22')
  influx.write('cpu,server=server3 value=0.22')

  return influx.writeImmediate('cpu,server=server1 value=0.31')
})

test('write errors', async () => {
  expect.assertions(1)

  const influx = new Influx()
  await influx.ready

  try {
    await influx.writeImmediate('fffff')
  } catch (e) {
    expect(e.message).toMatch('unable to parse')
  }
})

test('query', async () => {
  const influx = new Influx()
  await influx.ready

  await influx.writeImmediate('cpu,server=server7 value=0.77')
  const query = 'SELECT "value" FROM test.cpu WHERE "server" = \'server7\''

  const res = await influx.query(query)
  expect(typeof res[0].time).toBe('number')
  expect(res[0].value).toBe(0.77)

  const resRaw = await influx.query(query, false)
  expect(resRaw.columns).toEqual(['time', 'value'])
  expect(resRaw.values[0][1]).toBe(0.77)
})

test('buffer size', async () => {
  const influx = new Influx({ buffer: { maxSize: 3, maxTime: 1e6 } })
  await influx.ready

  await influx.write('memory,server=server1 value=12')
  await sleep(5)
  await influx.write('memory,server=server1 value=13')

  const res = await influx.query(`SELECT "value" FROM test.memory WHERE "server" = 'server1'`)
  expect(res.length).toBe(0)

  await influx.write('memory,server=server1 value=14')
  await sleep(5)
  await influx.write('memory,server=server1 value=15')

  const res2 = await influx.query(`SELECT "value" FROM test.memory WHERE "server" = 'server1'`)
  expect(res2.length).toBe(4)
})

test('buffer time', async () => {
  const influx = new Influx({ buffer: { maxSize: 1e3, maxTime: 1000 } })
  await influx.ready

  await influx.write('disk,server=server1 value=240')
  await sleep(5)
  await influx.write('disk,server=server1 value=240')

  const res = await influx.query(`SELECT "value" FROM test.disk WHERE "server" = 'server1'`)
  expect(res.length).toBe(0)

  await sleep(1000)

  const res2 = await influx.query(`SELECT "value" FROM test.disk WHERE "server" = 'server1'`)
  expect(res2.length).toBe(2)
})

test('influx.execute', async () => {
  const influx = new Influx({
    database: { name: 'mydb-2' },
    retentionPolicy: {
      name: 'one_day',
      duration: '1d',
      replication: 1,
      shardDuration: '1h',
      default: false
    }
  })

  await influx.ready

  const response = await influx.execute('SHOW RETENTION POLICIES ON "mydb-2"')
  const result = influx.formatQueryResponse(response)
  expect(result[0].name).toEqual('autogen')
  expect(result[1].name).toEqual('one_day')
})

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
