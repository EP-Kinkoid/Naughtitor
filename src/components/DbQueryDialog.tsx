import React, { useState } from 'react';
import type { DbConnectionConfig, DbQueryResult } from '../types';

interface Props {
  auditName: string;
  controlId: string;
  appId: string;
  initialConfig?: DbConnectionConfig;
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULT_CONFIG: DbConnectionConfig = {
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  database: '',
  username: '',
  password: '',
};

const DEFAULT_PORTS: Record<string, number> = {
  mysql: 3306,
  mssql: 1433,
  odbc: 20931,
};

export function DbQueryDialog({ auditName, controlId, appId, initialConfig, onClose, onSaved }: Props) {
  const [config, setConfig] = useState<DbConnectionConfig>(initialConfig || DEFAULT_CONFIG);
  const [query, setQuery] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [error, setError] = useState('');

  const updateConfig = (field: keyof DbConnectionConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  const handleTypeChange = (type: 'mysql' | 'mssql' | 'odbc') => {
    setConfig(prev => ({ ...prev, type, port: DEFAULT_PORTS[type] }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await window.naughtitor.testDbConnection(config);
      setTestResult(res.success ? 'Connection successful' : `Failed: ${res.error}`);
    } catch (err) {
      setTestResult(`Error: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleRunQuery = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await window.naughtitor.runDbQuery(auditName, controlId, appId, config, query);
      setResult(res.result);
      // Save the DB config on the application for future use
      await window.naughtitor.saveDbConfig(auditName, controlId, appId, config);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Database Query</h3>
          <button className="remove-btn" onClick={onClose}>x</button>
        </div>

        <div className="db-config">
          <div className="config-row">
            <label>Type</label>
            <select value={config.type} onChange={e => handleTypeChange(e.target.value as 'mysql' | 'mssql' | 'odbc')}>
              <option value="mysql">MySQL</option>
              <option value="mssql">MS SQL Server</option>
              <option value="odbc">Progress OpenEdge (ODBC)</option>
            </select>
          </div>
          <div className="config-row-group">
            <div className="config-row">
              <label>Host</label>
              <input type="text" value={config.host} onChange={e => updateConfig('host', e.target.value)} />
            </div>
            <div className="config-row narrow">
              <label>Port</label>
              <input type="number" value={config.port} onChange={e => updateConfig('port', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="config-row">
            <label>Database</label>
            <input type="text" value={config.database} onChange={e => updateConfig('database', e.target.value)} />
          </div>
          <div className="config-row-group">
            <div className="config-row">
              <label>Username</label>
              <input type="text" value={config.username} onChange={e => updateConfig('username', e.target.value)} />
            </div>
            <div className="config-row">
              <label>Password</label>
              <input type="password" value={config.password} onChange={e => updateConfig('password', e.target.value)} />
            </div>
          </div>
          <div className="config-actions">
            <button onClick={handleTestConnection} disabled={testing}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult && (
              <span className={testResult.startsWith('Connection successful') ? 'test-success' : 'test-fail'}>
                {testResult}
              </span>
            )}
          </div>
        </div>

        <div className="query-section">
          <label>SQL Query</label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="SELECT * FROM ..."
            rows={5}
          />
          <button className="action-btn query-btn" onClick={handleRunQuery} disabled={running || !query.trim()}>
            {running ? 'Running...' : 'Run Query & Save'}
          </button>
          {error && <p className="error-message">{error}</p>}
        </div>

        {result && (
          <div className="query-results">
            <p className="result-summary">{result.rowCount} rows returned</p>
            <div className="results-table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    {result.columns.map(col => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      {result.columns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rowCount > 50 && <p className="truncation-note">Showing first 50 of {result.rowCount} rows</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
