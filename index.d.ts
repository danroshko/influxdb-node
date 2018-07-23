export = Influx

declare class Influx {
  constructor(options?: IOptions)

  write(data: string): void
  writeImmediate(data: string): Promise<any>
  execute(query: string): Promise<any>
  query(query: string, convert?: boolean): Promise<any>
  formatQueryResponse(response: any, convert?: boolean): any
  onError(err: Error): void
}

interface IOptions {
  db?: string
  rp?: string
  host?: string
  port?: number
  maxBufferSize?: number
  maxBufferTime?: number
  retries?: number
  retriesInterval?: number
}
