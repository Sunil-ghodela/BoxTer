import React, { useState, useEffect } from 'react';

export default function UpdateBanner() {
  const [state, setState] = useState(null); // 'available' | 'downloaded' | 'error'
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.boxterAPI?.updater;
    if (!api) return;
    const offs = [
      api.onAvailable((info) => {
        setVersion(info?.version || '');
        setState('available');
        setDismissed(false);
      }),
      api.onDownloaded((info) => {
        setVersion(info?.version || '');
        setState('downloaded');
        setDismissed(false);
      }),
      api.onError((msg) => {
        setError(String(msg || 'unknown error'));
        setState('error');
      }),
    ];
    return () => offs.forEach((off) => off && off());
  }, []);

  if (!state || dismissed) return null;

  return (
    <div className={`update-banner update-banner-${state}`}>
      {state === 'available' && (
        <>
          <span>Downloading BoxTer {version}…</span>
          <button className="update-dismiss" onClick={() => setDismissed(true)}>Dismiss</button>
        </>
      )}
      {state === 'downloaded' && (
        <>
          <span>BoxTer {version} is ready to install.</span>
          <button
            className="update-action"
            onClick={() => window.boxterAPI?.updater.installAndRestart()}
          >
            Restart & install
          </button>
          <button className="update-dismiss" onClick={() => setDismissed(true)}>Later</button>
        </>
      )}
      {state === 'error' && (
        <>
          <span>Update check failed: {error}</span>
          <button className="update-dismiss" onClick={() => setDismissed(true)}>Dismiss</button>
        </>
      )}
    </div>
  );
}
