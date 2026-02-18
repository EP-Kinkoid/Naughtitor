import React, { useState, useEffect } from 'react';
import type { Registry, AppRecord, AuthMethod, EnvironmentType, DbConnectionConfig, EvidenceItem } from '../types';
import { ArchiveToggle } from './ArchiveToggle';

interface Props {
  registry: Registry;
  onRefreshRegistry: () => void;
  createApp: (app: AppRecord) => Promise<Registry>;
  updateApp: (appId: string, updates: Partial<AppRecord>) => Promise<Registry>;
  archiveApp: (appId: string) => Promise<Registry>;
  saveAppDbConfig: (appId: string, config: DbConnectionConfig) => Promise<Registry>;
}

const AUTH_METHODS: AuthMethod[] = ['SSO', 'LDAP', 'Local', 'OAuth', 'Other'];
const ENVIRONMENTS: EnvironmentType[] = ['Production', 'UAT', 'Development', 'Staging', 'Other'];

function emptyApp(): AppRecord {
  return {
    id: '',
    name: '',
    description: '',
    userBase: '',
    authMethod: 'SSO',
    authMethodOther: '',
    authorizationMethod: '',
    provisioningProcess: '',
    environment: 'Production',
    environmentOther: '',
    createdAt: new Date().toISOString(),
    archived: false,
  };
}

export function ApplicationsView({ registry, onRefreshRegistry, createApp, updateApp, archiveApp, saveAppDbConfig }: Props) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<AppRecord>(emptyApp());
  const [error, setError] = useState('');
  const [evidenceHistory, setEvidenceHistory] = useState<{ auditId: string; controlId: string; items: EvidenceItem[] }[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'evidence'>('details');

  const apps = showArchived
    ? registry.applications
    : registry.applications.filter(a => !a.archived);

  const selectedApp = registry.applications.find(a => a.id === selectedAppId);

  useEffect(() => {
    if (selectedAppId && activeTab === 'evidence') {
      window.naughtitor.listAllEvidenceForApp(selectedAppId).then(setEvidenceHistory);
    }
  }, [selectedAppId, activeTab]);

  const handleCreate = async () => {
    const name = draft.name.trim();
    if (!name) return;
    setError('');
    const id = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    try {
      const app: AppRecord = { ...draft, id, name, createdAt: new Date().toISOString() };
      await createApp(app);
      setCreating(false);
      setDraft(emptyApp());
      setSelectedAppId(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async () => {
    if (!selectedApp) return;
    setError('');
    try {
      await updateApp(selectedApp.id, draft);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleArchive = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Archive this application?')) return;
    await archiveApp(appId);
    if (selectedAppId === appId) setSelectedAppId(null);
  };

  const selectApp = (app: AppRecord) => {
    setSelectedAppId(app.id);
    setDraft({ ...app });
    setCreating(false);
    setActiveTab('details');
  };

  const startCreate = () => {
    setCreating(true);
    setSelectedAppId(null);
    setDraft(emptyApp());
    setError('');
  };

  const updateDraft = (field: keyof AppRecord, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const renderForm = (isNew: boolean) => (
    <div className="app-detail-form">
      <div className="form-row">
        <label>Name</label>
        <input type="text" value={draft.name} onChange={e => updateDraft('name', e.target.value)} placeholder="Application name" />
      </div>
      <div className="form-row">
        <label>Description</label>
        <textarea value={draft.description} onChange={e => updateDraft('description', e.target.value)} placeholder="What does this application do?" rows={3} />
      </div>
      <div className="form-row">
        <label>User Base</label>
        <input type="text" value={draft.userBase} onChange={e => updateDraft('userBase', e.target.value)} placeholder="e.g. 500 internal users, 10k customers" />
      </div>
      <div className="form-row-group">
        <div className="form-row">
          <label>Auth Method</label>
          <select value={draft.authMethod} onChange={e => updateDraft('authMethod', e.target.value)}>
            {AUTH_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {draft.authMethod === 'Other' && (
          <div className="form-row">
            <label>Auth Method (specify)</label>
            <input type="text" value={draft.authMethodOther} onChange={e => updateDraft('authMethodOther', e.target.value)} />
          </div>
        )}
      </div>
      <div className="form-row">
        <label>Authorization Method</label>
        <textarea value={draft.authorizationMethod} onChange={e => updateDraft('authorizationMethod', e.target.value)} placeholder="How are permissions/roles assigned?" rows={2} />
      </div>
      <div className="form-row">
        <label>Provisioning Process</label>
        <textarea value={draft.provisioningProcess} onChange={e => updateDraft('provisioningProcess', e.target.value)} placeholder="How are new users provisioned?" rows={2} />
      </div>
      <div className="form-row-group">
        <div className="form-row">
          <label>Environment</label>
          <select value={draft.environment} onChange={e => updateDraft('environment', e.target.value)}>
            {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {draft.environment === 'Other' && (
          <div className="form-row">
            <label>Environment (specify)</label>
            <input type="text" value={draft.environmentOther} onChange={e => updateDraft('environmentOther', e.target.value)} />
          </div>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="form-actions">
        {isNew ? (
          <>
            <button onClick={handleCreate} disabled={!draft.name.trim()}>Create Application</button>
            <button className="small-btn" onClick={() => setCreating(false)}>Cancel</button>
          </>
        ) : (
          <button onClick={handleSave}>Save Changes</button>
        )}
      </div>
    </div>
  );

  const renderEvidenceHistory = () => (
    <div className="evidence-history">
      {evidenceHistory.length === 0 ? (
        <p className="empty">No evidence collected for this application yet.</p>
      ) : (
        evidenceHistory.map(group => (
          <div key={`${group.auditId}-${group.controlId}`} className="evidence-history-group">
            <h4>{group.auditId} / {group.controlId}</h4>
            <div className="evidence-history-items">
              {group.items.map(item => (
                <div key={item.filename} className="evidence-history-item">
                  <span className="req-type-badge">{item.type}</span>
                  <span>{item.filename}</span>
                  <span className="timestamp">{new Date(item.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="entity-split-view">
      <div className="entity-list-panel">
        <div className="entity-list-header">
          <h2>Applications</h2>
          <ArchiveToggle show={showArchived} onToggle={setShowArchived} />
        </div>
        <button className="action-btn" onClick={startCreate}>New Application</button>
        <div className="entity-items">
          {apps.map(app => (
            <div
              key={app.id}
              className={`entity-item ${selectedAppId === app.id ? 'selected' : ''} ${app.archived ? 'archived' : ''}`}
              onClick={() => !app.archived && selectApp(app)}
            >
              <div className="entity-item-info">
                <span className="entity-item-name">{app.name}</span>
                <span className="entity-item-meta">
                  {app.environment}
                  {app.archived && <span className="archive-badge">Archived</span>}
                </span>
              </div>
              {!app.archived && (
                <button className="remove-btn" onClick={e => handleArchive(app.id, e)} title="Archive">x</button>
              )}
            </div>
          ))}
          {apps.length === 0 && <p className="empty">No applications yet.</p>}
        </div>
      </div>

      <div className="entity-detail-panel">
        {creating ? (
          <>
            <h3>New Application</h3>
            {renderForm(true)}
          </>
        ) : selectedApp ? (
          <>
            <div className="detail-tabs">
              <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details</button>
              <button className={`tab-btn ${activeTab === 'evidence' ? 'active' : ''}`} onClick={() => setActiveTab('evidence')}>Evidence History</button>
            </div>
            {activeTab === 'details' ? renderForm(false) : renderEvidenceHistory()}
          </>
        ) : (
          <div className="placeholder">
            <p>Select an application or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
