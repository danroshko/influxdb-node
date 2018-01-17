/* global test, expect */
const Influx = require('../index')

test('default config', async () => {
  const influx = new Influx()
  await influx.execute('CREATE DATABASE test')
  return influx.writeImmediate('cpu,server=server1 value=0.31')
})

test('full config', async () => {
  const influx = new Influx({
    db: 'test',
    rp: 'one_day',
    maxBufferSize: 1000,
    maxBufferTime: 1000
  })

  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')
  return influx.writeImmediate('cpu,server=server1 value=0.31')
})

test('writes', async () => {
  const influx = new Influx()
  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')

  influx.write('cpu,server=server1 value=0.22')
  influx.write('cpu,server=server2 value=0.22')
  influx.write('cpu,server=server3 value=0.22')

  return influx.writeImmediate('cpu,server=server1 value=0.31')
})

test('write errors', async () => {
  expect.assertions(1)

  const influx = new Influx()

  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')

  try {
    await influx.writeImmediate('fffff')
  } catch (e) {
    expect(e.message).toMatch('unable to parse')
  }
})

test('query', async () => {
  const influx = new Influx({ rp: 'one_day' })

  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')

  await influx.writeImmediate('cpu,server=server7 value=0.77')
  const query = 'SELECT "value" FROM "one_day"."cpu" WHERE "server" = \'server7\''

  const res = await influx.query(query)
  expect(typeof res[0].time).toBe('number')
  expect(res[0].value).toBe(0.77)

  const resRaw = await influx.query(query, false)
  expect(resRaw.columns).toEqual(['time', 'value'])
  expect(resRaw.values[0][1]).toBe(0.77)
})

test('buffer size', async () => {
  const influx = new Influx({ rp: 'one_day', maxBufferSize: 3, maxBufferTime: 1e6 })

  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')

  await influx.write('memory,server=server1 value=12')
  await sleep(5)
  await influx.write('memory,server=server1 value=13')

  const res = await influx.query(`SELECT "value" FROM one_day.memory WHERE "server" = 'server1'`)
  expect(res.length).toBe(0)

  await influx.write('memory,server=server1 value=14')
  await sleep(5)
  await influx.write('memory,server=server1 value=15')

  const res2 = await influx.query(`SELECT "value" FROM one_day.memory WHERE "server" = 'server1'`)
  expect(res2.length).toBe(4)
})

test('buffer time', async () => {
  const influx = new Influx({ rp: 'one_day', maxBufferSize: 1e3, maxBufferTime: 1000 })

  await influx.execute('CREATE DATABASE test')
  await influx.execute('CREATE RETENTION POLICY one_day ON test DURATION 1d REPLICATION 1')

  await influx.write('disk,server=server1 value=240')
  await sleep(5)
  await influx.write('disk,server=server1 value=240')

  const res = await influx.query(`SELECT "value" FROM one_day.disk WHERE "server" = 'server1'`)
  expect(res.length).toBe(0)

  await sleep(1000)

  const res2 = await influx.query(`SELECT "value" FROM one_day.disk WHERE "server" = 'server1'`)
  expect(res2.length).toBe(2)
})

test('influx.execute', async () => {
  const influx = new Influx({
    db: 'mydb-2',
    rp: 'one_week'
  })

  await influx.execute('CREATE DATABASE "mydb-2"')
  await influx.execute('CREATE RETENTION POLICY one_week ON "mydb-2" DURATION 1w REPLICATION 1')

  const response = await influx.execute('SHOW RETENTION POLICIES ON "mydb-2"')
  const result = influx.formatQueryResponse(response)
  expect(result[0].name).toEqual('autogen')
  expect(result[1].name).toEqual('one_week')
})

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
