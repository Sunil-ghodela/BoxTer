import React, { useCallback, useEffect, useRef, useState } from 'react';

const IMAGE_MIME_RE = /^image\//i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;

const formatSize = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const mimeFromName = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
    ico: 'image/x-icon',
  };
  return map[ext] || '';
};

const isImageFile = (file) =>
  IMAGE_MIME_RE.test(file.mime || mimeFromName(file.name)) || IMAGE_EXT_RE.test(file.name);

export default function FilesPanel({ id }) {
  const [files, setFiles] = useState([]);
  const [thumbs, setThumbs] = useState({}); // name → data url
  const [dragOver, setDragOver] = useState(false);
  const [renaming, setRenaming] = useState(null); // name being renamed
  const [renameDraft, setRenameDraft] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);

  const api = window.boxterAPI?.files;

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const list = await api.list(id);
      setFiles(list || []);
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [api, id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Generate thumbnails for new image entries
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    (async () => {
      const next = { ...thumbs };
      let changed = false;
      for (const f of files) {
        if (!isImageFile(f) || next[f.name]) continue;
        try {
          const url = await api.readDataUrl(id, f.name, f.mime || mimeFromName(f.name));
          if (cancelled) return;
          next[f.name] = url;
          changed = true;
        } catch { /* ignore */ }
      }
      // Drop thumbs for files that no longer exist
      for (const name of Object.keys(next)) {
        if (!files.find((f) => f.name === name)) { delete next[name]; changed = true; }
      }
      if (changed && !cancelled) setThumbs(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, api, id]);

  const saveBlob = useCallback(async (name, blobOrBuffer) => {
    if (!api) return;
    let buf;
    if (blobOrBuffer instanceof ArrayBuffer) {
      buf = new Uint8Array(blobOrBuffer);
    } else if (blobOrBuffer instanceof Uint8Array) {
      buf = blobOrBuffer;
    } else if (blobOrBuffer && typeof blobOrBuffer.arrayBuffer === 'function') {
      buf = new Uint8Array(await blobOrBuffer.arrayBuffer());
    } else {
      throw new Error('unsupported payload');
    }
    await api.save(id, name, buf);
  }, [api, id]);

  const importFileList = useCallback(async (fileList) => {
    if (!api || !fileList || fileList.length === 0) return;
    const pathResolver = window.boxterAPI?.files?.pathForFile;
    const nativePaths = [];
    const memoryFiles = [];
    for (const f of Array.from(fileList)) {
      const p = pathResolver ? pathResolver(f) : '';
      if (p) nativePaths.push(p);
      else memoryFiles.push(f);
    }
    try {
      if (nativePaths.length) await api.importPaths(id, nativePaths);
      for (const f of memoryFiles) {
        const buf = new Uint8Array(await f.arrayBuffer());
        await api.save(id, f.name || 'file', buf);
      }
      await refresh();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }, [api, id, refresh]);

  // Drag-drop
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files && dt.files.length) importFileList(dt.files);
  }, [importFileList]);

  // Paste — images from clipboard, or File objects
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const onPaste = async (e) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const items = Array.from(dt.items || []);
      const files = [];
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        const list = new DataTransfer();
        files.forEach((f) => list.items.add(f));
        importFileList(list.files);
        return;
      }
      // Plain-text paste → save as a .txt file named with a timestamp
      const txt = dt.getData('text');
      if (txt && txt.trim()) {
        e.preventDefault();
        const name = `clipboard-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        try {
          await saveBlob(name, new TextEncoder().encode(txt));
          refresh();
        } catch (err) { setError(String(err?.message || err)); }
      }
    };
    el.addEventListener('paste', onPaste);
    return () => el.removeEventListener('paste', onPaste);
  }, [importFileList, saveBlob, refresh]);

  const onBrowse = () => fileInputRef.current?.click();
  const onInputChange = (e) => {
    importFileList(e.target.files);
    e.target.value = '';
  };

  const onOpen = (name) => api?.open(id, name);
  const onReveal = (name) => api?.reveal(id, name);
  const onDelete = async (name) => {
    if (!api) return;
    try { await api.delete(id, name); await refresh(); }
    catch (e) { setError(String(e?.message || e)); }
  };
  const startRename = (name) => { setRenaming(name); setRenameDraft(name); };
  const commitRename = async () => {
    const oldName = renaming;
    const newName = (renameDraft || '').trim();
    setRenaming(null);
    if (!oldName || !newName || newName === oldName) return;
    try { await api.rename(id, oldName, newName); await refresh(); }
    catch (e) { setError(String(e?.message || e)); }
  };
  const cancelRename = () => { setRenaming(null); setRenameDraft(''); };

  return (
    <div
      ref={panelRef}
      className={`files-panel${dragOver ? ' files-panel-dragover' : ''}`}
      tabIndex={0}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="files-toolbar">
        <button className="files-btn" onClick={onBrowse}>Add files…</button>
        <span className="files-hint">
          Drop files here · paste images · {files.length} item{files.length === 1 ? '' : 's'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
      </div>

      {error && (
        <div className="files-error" onClick={() => setError('')} title="Click to dismiss">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="files-empty">
          <div className="files-empty-icon">+</div>
          <div>Drop files or paste images here</div>
          <button className="files-btn" onClick={onBrowse}>Browse…</button>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((f) => {
            const isImg = isImageFile(f);
            const thumb = thumbs[f.name];
            return (
              <div
                key={f.name}
                className="files-item"
                title={`${f.name}\n(drag to terminal to paste path)`}
                draggable
                onDragStart={(e) => {
                  if (!f.path) return;
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('application/x-boxter-file-path', f.path);
                  e.dataTransfer.setData('text/plain', f.path);
                }}
              >
                <div
                  className={`files-thumb${isImg ? ' files-thumb-image' : ''}`}
                  onDoubleClick={() => onOpen(f.name)}
                >
                  {isImg && thumb ? (
                    <img src={thumb} alt={f.name} draggable={false} />
                  ) : (
                    <div className="files-thumb-placeholder">
                      {f.name.split('.').pop().slice(0, 4).toUpperCase() || 'FILE'}
                    </div>
                  )}
                </div>
                <div className="files-meta">
                  {renaming === f.name ? (
                    <input
                      className="files-rename-input"
                      value={renameDraft}
                      autoFocus
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                    />
                  ) : (
                    <div
                      className="files-name"
                      onDoubleClick={() => startRename(f.name)}
                      title="Double-click to rename"
                    >
                      {f.name}
                    </div>
                  )}
                  <div className="files-size">{formatSize(f.size)}</div>
                </div>
                <div className="files-actions">
                  <button onClick={() => onOpen(f.name)} title="Open">o</button>
                  <button onClick={() => onReveal(f.name)} title="Reveal in file manager">r</button>
                  <button onClick={() => startRename(f.name)} title="Rename">e</button>
                  <button onClick={() => onDelete(f.name)} title="Delete" className="files-del">x</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dragOver && (
        <div className="files-drop-overlay">
          <div>Drop to add</div>
        </div>
      )}
    </div>
  );
}
