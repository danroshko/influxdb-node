# Influxdb-node

Minimal InfluxDB client library for Node.js. Features:

* execute arbitrary InfluxDB commands using Line Protocol and Query Language
* buffer writes to InfluxDB
* optionally transform responses from InfluxDb into more convenient arrays of objects
* write retires

## Installation

```bash
npm i @danroshko/influx-node
```

## Usage

```javascript
const Influx = require('@danroshko/influxdb-node');

/* this is the default configuration, all values are optional */
const influx = new Influx({
  db: 'test',
  rp: 'autogen',
  host: '127.0.0.1',
  port: 8086,
  maxBufferSize: 100,
  maxBufferTime: 1000,
  retries: 2,
  retriesInterval: 50
});

influx
  .execute('CREATE DATABASE mydb')
  .then(() => {
    return influx.execute('CREATE RETENTION POLICY one_day ON mydb DURATION 1d REPLICATION 1');
  })
  .then(() => {
    console.log('Database and RP have been created');
  });

/* add point to the internal buffer, it will be
   written to InfluxDB on next buffer flush */
influx.write('cpu,host=server1 value=0.22');

/* write without buffering */
influx.writeImmediate('cpu,host=server1 value=0.22');

influx.query('SELECT "value" FROM test.cpu').then(results => {
  console.log(results);
});
```

## Run tests

```bash
sudo docker run -it --rm --network="host" influxdb:1.5.1
npm test
```
