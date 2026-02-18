import React from 'react';

interface Props {
  show: boolean;
  onToggle: (show: boolean) => void;
}

export function ArchiveToggle({ show, onToggle }: Props) {
  return (
    <label className="archive-toggle">
      <input
        type="checkbox"
        checked={show}
        onChange={e => onToggle(e.target.checked)}
      />
      <span>Show archived</span>
    </label>
  );
}
