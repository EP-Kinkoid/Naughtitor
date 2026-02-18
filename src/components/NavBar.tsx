import React from 'react';

export type View = 'home' | 'applications' | 'controls' | 'audits';

interface Props {
  currentView: View;
  onNavigate: (view: View) => void;
}

export function NavBar({ currentView, onNavigate }: Props) {
  const items: { view: View; label: string }[] = [
    { view: 'home', label: 'Home' },
    { view: 'applications', label: 'Applications' },
    { view: 'controls', label: 'Controls' },
    { view: 'audits', label: 'Audits' },
  ];

  return (
    <nav className="nav-bar">
      <span className="nav-brand">Naughtitor</span>
      <div className="nav-items">
        {items.map(item => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
