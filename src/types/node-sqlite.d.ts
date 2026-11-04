// Node 22 SQLite declarations for this project's Node 20 type package.
declare module "node:sqlite" {
  type Value = string | number | bigint | null | Uint8Array;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...values: Value[]): { changes: number | bigint };
      get(...values: Value[]): Record<string, Value> | undefined;
      all(...values: Value[]): Record<string, Value>[];
    };
    close(): void;
  }
}
