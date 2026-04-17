// Binary tree describing a terminal panel's split layout.
//
//   leaf  = { t: 'leaf',  id: '<termId>' }
//   split = { t: 'split', dir: 'h' | 'v', ratio: 0..1, a: Node, b: Node }
//
// dir === 'h' arranges children side-by-side (vertical divider).
// dir === 'v' stacks children top/bottom (horizontal divider).

let leafCounter = 0;

export function genLeafId(panelId) {
  leafCounter += 1;
  return `${panelId}-l-${Date.now().toString(36)}-${leafCounter}`;
}

export const makeLeaf = (id) => ({ t: 'leaf', id });

export const makeSplit = (dir, a, b, ratio = 0.5) => ({ t: 'split', dir, ratio, a, b });

// Replace the specified leaf with a split containing the original leaf and a
// new leaf. If `newFirst` is true, the new leaf is placed first.
export function splitTree(tree, leafId, dir, newLeafId, newFirst = false) {
  if (!tree) return tree;
  if (tree.t === 'leaf') {
    if (tree.id !== leafId) return tree;
    const fresh = makeLeaf(newLeafId);
    return newFirst ? makeSplit(dir, fresh, tree) : makeSplit(dir, tree, fresh);
  }
  return {
    ...tree,
    a: splitTree(tree.a, leafId, dir, newLeafId, newFirst),
    b: splitTree(tree.b, leafId, dir, newLeafId, newFirst),
  };
}

// Remove a leaf. If its sibling becomes orphaned, collapse the split.
// Returns new tree or null when the last leaf is closed.
export function closeLeaf(tree, leafId) {
  if (!tree) return null;
  if (tree.t === 'leaf') return tree.id === leafId ? null : tree;
  const newA = closeLeaf(tree.a, leafId);
  const newB = closeLeaf(tree.b, leafId);
  if (newA === null) return newB;
  if (newB === null) return newA;
  if (newA === tree.a && newB === tree.b) return tree;
  return { ...tree, a: newA, b: newB };
}

// Walk all leaf ids in order (left-to-right, depth-first).
export function allLeaves(tree) {
  if (!tree) return [];
  if (tree.t === 'leaf') return [tree.id];
  return [...allLeaves(tree.a), ...allLeaves(tree.b)];
}

export function firstLeafId(tree) {
  if (!tree) return null;
  if (tree.t === 'leaf') return tree.id;
  return firstLeafId(tree.a);
}

// Update the ratio at the split addressed by `path` (array of 'a'/'b').
export function setRatio(tree, path, ratio) {
  if (path.length === 0) {
    if (tree.t !== 'split') return tree;
    return { ...tree, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
  }
  const [head, ...rest] = path;
  return { ...tree, [head]: setRatio(tree[head], rest, ratio) };
}

// Regenerate every leaf id (used when duplicating a panel).
export function regenerateLeafIds(tree, panelId) {
  if (!tree) return tree;
  if (tree.t === 'leaf') return makeLeaf(genLeafId(panelId));
  return {
    ...tree,
    a: regenerateLeafIds(tree.a, panelId),
    b: regenerateLeafIds(tree.b, panelId),
  };
}

export function hasLeaf(tree, leafId) {
  if (!tree) return false;
  if (tree.t === 'leaf') return tree.id === leafId;
  return hasLeaf(tree.a, leafId) || hasLeaf(tree.b, leafId);
}
