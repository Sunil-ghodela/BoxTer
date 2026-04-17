import React, { useEffect, useState } from 'react';

export default function BrowserPlaceholder({ id }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`boxter-browser-${id}`);
      if (saved) setUrl(saved);
    } catch { /* ignore */ }
  }, [id]);

  let host = '';
  try { host = url ? new URL(url).hostname : ''; } catch { /* ignore */ }

  return (
    <div className="browser-placeholder">
      <div className="browser-placeholder-icon">@</div>
      <div className="browser-placeholder-title">Browser panel</div>
      <div className="browser-placeholder-url">{host || url || '(no URL set)'}</div>
      <div className="browser-placeholder-hint">
        Live browser only renders in Grid view.<br />
        Switch to Grid mode to interact.
      </div>
    </div>
  );
}
