import * as mysql from 'mysql2/promise';
import * as mssql from 'mssql';
import * as odbc from 'odbc';

interface DbConnectionConfig {
  type: 'mysql' | 'mssql' | 'odbc';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  query: string;
  executedAt: string;
}

export async function testConnection(config: DbConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    switch (config.type) {
      case 'mysql': {
        const conn = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          connectTimeout: 10000,
        });
        await conn.ping();
        await conn.end();
        break;
      }
      case 'mssql': {
        const pool = await mssql.connect({
          server: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          options: { encrypt: false, trustServerCertificate: true },
          connectionTimeout: 10000,
        });
        await pool.close();
        break;
      }
      case 'odbc': {
        const connStr = `DRIVER={Progress OpenEdge ${config.database} Driver};HOST=${config.host};PORT=${config.port};DB=${config.database};UID=${config.username};PWD=${config.password}`;
        const conn = await odbc.connect(connStr);
        await conn.close();
        break;
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function runQuery(config: DbConnectionConfig, sql: string): Promise<QueryResult> {
  const executedAt = new Date().toISOString();

  switch (config.type) {
    case 'mysql': {
      const conn = await mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        connectTimeout: 10000,
      });
      try {
        const [rows, fields] = await conn.query(sql);
        const resultRows = Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
        const columns = fields && Array.isArray(fields) ? fields.map(f => f.name) : [];
        return { columns, rows: resultRows, rowCount: resultRows.length, query: sql, executedAt };
      } finally {
        await conn.end();
      }
    }
    case 'mssql': {
      const pool = await mssql.connect({
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        options: { encrypt: false, trustServerCertificate: true },
        connectionTimeout: 10000,
      });
      try {
        const result = await pool.request().query(sql);
        const columns = result.recordset?.columns ? Object.keys(result.recordset.columns) : [];
        const rows = result.recordset || [];
        return { columns, rows, rowCount: rows.length, query: sql, executedAt };
      } finally {
        await pool.close();
      }
    }
    case 'odbc': {
      const connStr = `DRIVER={Progress OpenEdge ${config.database} Driver};HOST=${config.host};PORT=${config.port};DB=${config.database};UID=${config.username};PWD=${config.password}`;
      const conn = await odbc.connect(connStr);
      try {
        const result = await conn.query(sql);
        const rows = result as Record<string, unknown>[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return { columns, rows, rowCount: rows.length, query: sql, executedAt };
      } finally {
        await conn.close();
      }
    }
  }
}
