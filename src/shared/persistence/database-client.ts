export type DatabaseRunResult = {
  changes: number;
  lastInsertRowid?: number | bigint;
};

export interface DatabaseSession {
  execute(sql: string, params?: unknown[]): Promise<DatabaseRunResult>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  queryMany<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

export type DatabaseHealth = {
  provider: 'oracle' | 'in-memory';
  healthy: boolean;
  serverVersion?: string;
  error?: string;
};

export interface DatabaseClient extends DatabaseSession {
  readonly provider: 'oracle' | 'in-memory';
  initialize(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<DatabaseHealth>;
  transaction<T>(work: (session: DatabaseSession) => Promise<T>): Promise<T>;
}
