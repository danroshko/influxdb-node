# Influxdb-node

Minimal InfluxDB client library for Node.js. Features:

* ensures that database and retention policy are created
* buffer writes to InfluxDB
* transform overly verbose responses from InfluxDb into more convenient arrays of objects

_Note:_ this library does not hide InfluxDB Line Protocol and Query Language.
Use an official [node-influx](https://github.com/node-influx/node-influx) client for more high-level abstractions.

## Installation

```bash
npm i @danroshko/influx-node
```

## Usage

```javascript
const Influx = require('@danroshko/influxdb-node');

/* this is the default configuration, all values are optional */
const influx = new Influx({
  database: {
    name: 'test',
    host: '127.0.0.1',
    port: 8086
  },
  retentionPolicy: {
    name: 'test',
    duration: 'INF',
    replication: 1,
    shardDuration: null,
    default: true
  },
  buffer: {
    maxSize: 100,
    maxTime: 1000
  }
});

influx.ready.then(() => {
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
sudo docker run -it --rm --network="host" influxdb:1.4.2
npm test
```
