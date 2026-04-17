import React, { useCallback, useRef, useState, useEffect } from 'react';
import TerminalLeaf from './TerminalLeaf.jsx';
import {
  splitTree,
  closeLeaf,
  setRatio,
  firstLeafId,
  genLeafId,
  hasLeaf,
  allLeaves,
} from '../utils/terminalTree.js';

const DEFAULT_TREE = (id) => ({ t: 'leaf', id });

export default function TerminalPanel({
  id,
  tree: treeProp,
  focusedLeaf: focusedLeafProp,
  onTreeChange,
  onFocusedLeafChange,
  onClose,
  getPipeFor,
}) {
  // Work with a stable tree. If parent controls it, use prop; else local.
  const [localTree, setLocalTree] = useState(() => treeProp || DEFAULT_TREE(id));
  const tree = treeProp || localTree;

  const updateTree = useCallback((next) => {
    if (onTreeChange) onTreeChange(next);
    else setLocalTree(next);
  }, [onTreeChange]);

  const [localFocused, setLocalFocused] = useState(() => focusedLeafProp || firstLeafId(tree) || id);
  const focusedLeaf = focusedLeafProp || localFocused;

  const setFocusedLeaf = useCallback((leafId) => {
    if (onFocusedLeafChange) onFocusedLeafChange(leafId);
    else setLocalFocused(leafId);
  }, [onFocusedLeafChange]);

  // Keep focused leaf valid when tree changes (leaf closed, etc.)
  useEffect(() => {
    if (!hasLeaf(tree, focusedLeaf)) {
      const first = firstLeafId(tree);
      if (first) setFocusedLeaf(first);
    }
  }, [tree, focusedLeaf, setFocusedLeaf]);

  const doSplit = useCallback((dir) => {
    const newLeafId = genLeafId(id);
    updateTree(splitTree(tree, focusedLeaf, dir, newLeafId));
    setFocusedLeaf(newLeafId);
  }, [tree, focusedLeaf, id, updateTree, setFocusedLeaf]);

  const doClose = useCallback(() => {
    // Close the focused pane; if it's the only leaf, bubble up to close the panel
    const leaves = allLeaves(tree);
    if (leaves.length <= 1) {
      onClose?.(id);
      return;
    }
    const next = closeLeaf(tree, focusedLeaf);
    if (!next) {
      onClose?.(id);
      return;
    }
    updateTree(next);
    const nextFocus = firstLeafId(next);
    if (nextFocus) setFocusedLeaf(nextFocus);
  }, [tree, focusedLeaf, id, onClose, updateTree, setFocusedLeaf]);

  // Divider drag to resize
  const dragRef = useRef(null);
  const startResize = useCallback((path, dir, container) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      path,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      container,
      startRatio: null,
    };
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const s = dragRef.current;
      if (!s || !s.container) return;
      const rect = s.container.getBoundingClientRect();
      const size = s.dir === 'h' ? rect.width : rect.height;
      if (!size) return;
      const delta = s.dir === 'h' ? (e.clientX - s.startX) : (e.clientY - s.startY);
      // Read current ratio at path
      let node = tree;
      for (const step of s.path) node = node[step];
      if (s.startRatio == null) s.startRatio = node.ratio;
      const ratio = s.startRatio + delta / size;
      updateTree(setRatio(tree, s.path, ratio));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [tree, updateTree]);

  const renderNode = (node, path = [], containerRef = { current: null }) => {
    if (node.t === 'leaf') {
      const pipeInfo = getPipeFor ? getPipeFor(node.id) : null;
      return (
        <TerminalLeaf
          key={node.id}
          id={node.id}
          isFocused={node.id === focusedLeaf}
          onFocus={() => setFocusedLeaf(node.id)}
          onSplitH={() => doSplit('h')}
          onSplitV={() => doSplit('v')}
          onClosePane={() => {
            const leaves = allLeaves(tree);
            if (leaves.length <= 1) {
              onClose?.(id);
            } else {
              const next = closeLeaf(tree, node.id);
              if (!next) onClose?.(id);
              else {
                updateTree(next);
                const nf = firstLeafId(next);
                if (nf) setFocusedLeaf(nf);
              }
            }
          }}
          pipeToNotes={pipeInfo?.notesId || null}
          pipeLabel={pipeInfo?.label || null}
        />
      );
    }
    const dir = node.dir;
    return (
      <div
        key={path.join('-') || 'root-split'}
        className={`terminal-split terminal-split-${dir}`}
        ref={(el) => { containerRef.current = el; }}
      >
        <div className="terminal-pane" style={{ flex: node.ratio }}>
          {renderNode(node.a, [...path, 'a'], { current: null })}
        </div>
        <div
          className={`terminal-divider terminal-divider-${dir}`}
          onMouseDown={startResize(path, dir, containerRef.current)}
        />
        <div className="terminal-pane" style={{ flex: 1 - node.ratio }}>
          {renderNode(node.b, [...path, 'b'], { current: null })}
        </div>
      </div>
    );
  };

  // Ref for the root container so divider resize knows the axis size
  const rootRef = useRef(null);

  const renderTree = () => {
    if (tree.t === 'leaf') {
      return renderNode(tree, [], rootRef);
    }
    // Wrap with root ref so the top-level split can read its bounding box
    const dir = tree.dir;
    return (
      <div
        className={`terminal-split terminal-split-${dir}`}
        ref={rootRef}
      >
        <div className="terminal-pane" style={{ flex: tree.ratio }}>
          {renderNode(tree.a, ['a'], { current: null })}
        </div>
        <div
          className={`terminal-divider terminal-divider-${dir}`}
          onMouseDown={startResize([], dir, rootRef.current)}
        />
        <div className="terminal-pane" style={{ flex: 1 - tree.ratio }}>
          {renderNode(tree.b, ['b'], { current: null })}
        </div>
      </div>
    );
  };

  return <div className="terminal-root">{renderTree()}</div>;
}
