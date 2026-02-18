import React from 'react';
import type { Registry } from '../types';
import type { View } from './NavBar';

interface Props {
  registry: Registry;
  onNavigate: (view: View) => void;
}

export function HomeView({ registry, onNavigate }: Props) {
  const activeApps = registry.applications.filter(a => !a.archived);
  const activeControls = registry.controls.filter(c => !c.archived);
  const activeAudits = registry.audits.filter(a => !a.archived);

  return (
    <div className="home-view">
      <h1>Naughtitor</h1>
      <p className="subtitle">System Documentation &amp; SOX Audit Evidence</p>

      <div className="summary-cards">
        <button className="summary-card" onClick={() => onNavigate('applications')}>
          <span className="summary-count">{activeApps.length}</span>
          <span className="summary-label">Applications</span>
        </button>
        <button className="summary-card" onClick={() => onNavigate('controls')}>
          <span className="summary-count">{activeControls.length}</span>
          <span className="summary-label">Controls</span>
        </button>
        <button className="summary-card" onClick={() => onNavigate('audits')}>
          <span className="summary-count">{activeAudits.length}</span>
          <span className="summary-label">Audits</span>
        </button>
      </div>

      <div className="home-sections">
        {activeAudits.length > 0 && (
          <div className="home-section">
            <h3>Recent Audits</h3>
            <div className="home-list">
              {activeAudits.slice(0, 5).map(audit => (
                <div key={audit.id} className="home-list-item">
                  <span className="home-item-name">{audit.name}</span>
                  <span className="home-item-meta">{audit.controlApps.length} scope items</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeApps.length > 0 && (
          <div className="home-section">
            <h3>Applications</h3>
            <div className="home-list">
              {activeApps.slice(0, 5).map(app => (
                <div key={app.id} className="home-list-item">
                  <span className="home-item-name">{app.name}</span>
                  <span className="home-item-meta">{app.environment}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
