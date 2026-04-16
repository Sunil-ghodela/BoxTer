import React, { useState, useRef, useCallback } from 'react';

export default function BrowserPanel({ id }) {
  const [url, setUrl] = useState('https://www.google.com');
  const [inputUrl, setInputUrl] = useState('https://www.google.com');
  const [isLoading, setIsLoading] = useState(true);
  const webviewRef = useRef(null);

  const navigate = useCallback((e) => {
    e?.preventDefault();
    let target = inputUrl.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    setUrl(target);
    setIsLoading(true);
  }, [inputUrl]);

  const goBack = () => webviewRef.current?.goBack();
  const goForward = () => webviewRef.current?.goForward();
  const reload = () => webviewRef.current?.reload();

  return (
    <div className="browser-panel">
      <form className="browser-nav" onSubmit={navigate}>
        <button type="button" onClick={goBack} className="nav-btn" title="Back">&lt;</button>
        <button type="button" onClick={goForward} className="nav-btn" title="Forward">&gt;</button>
        <button type="button" onClick={reload} className="nav-btn" title="Reload">r</button>
        <input
          type="text"
          className="url-bar"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate(e)}
          placeholder="Enter URL..."
        />
        <button type="submit" className="nav-btn go-btn">Go</button>
      </form>
      <div className="browser-content">
        {isLoading && <div className="browser-loading">Loading...</div>}
        <webview
          ref={webviewRef}
          src={url}
          className="browser-webview"
          onDidStartLoading={() => setIsLoading(true)}
          onDidStopLoading={() => setIsLoading(false)}
          onDidNavigate={(e) => setInputUrl(e.url)}
        />
      </div>
    </div>
  );
}
