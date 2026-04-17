// Built-in workspace templates. Each produces a fresh workspace with
// predefined panels, a grid layout, and initial canvas positions.

export const TEMPLATES = [
  {
    id: 'dev-setup',
    name: 'Dev Setup',
    description: 'Two terminals side-by-side with a notes panel below.',
    icon: '>',
    accent: '#50fa7b',
    panels: [
      { type: 'terminal', name: 'Main',    grid: { x: 0, y: 0, w: 6, h: 6 }, canvas: { x: 20,  y: 20, w: 480, h: 340 } },
      { type: 'terminal', name: 'Tests',   grid: { x: 6, y: 0, w: 6, h: 6 }, canvas: { x: 520, y: 20, w: 480, h: 340 } },
      { type: 'notes',    name: 'Scratch', grid: { x: 0, y: 6, w: 12, h: 3 }, canvas: { x: 20, y: 380, w: 980, h: 220 } },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Browser, notes, and a files panel for gathering references.',
    icon: '@',
    accent: '#ff79c6',
    panels: [
      { type: 'browser', name: 'Sources', grid: { x: 0, y: 0, w: 7, h: 8 }, canvas: { x: 20,  y: 20, w: 600, h: 480 } },
      { type: 'notes',   name: 'Notes',   grid: { x: 7, y: 0, w: 5, h: 5 }, canvas: { x: 640, y: 20, w: 420, h: 280 } },
      { type: 'files',   name: 'PDFs',    grid: { x: 7, y: 5, w: 5, h: 3 }, canvas: { x: 640, y: 320, w: 420, h: 180 } },
    ],
  },
  {
    id: 'debug',
    name: 'Debug',
    description: 'Three terminals and a files drop-zone for logs.',
    icon: 'D',
    accent: '#ff4757',
    panels: [
      { type: 'terminal', name: 'app',   grid: { x: 0, y: 0, w: 6, h: 5 }, canvas: { x: 20,  y: 20,  w: 480, h: 300 } },
      { type: 'terminal', name: 'logs',  grid: { x: 6, y: 0, w: 6, h: 5 }, canvas: { x: 520, y: 20,  w: 480, h: 300 } },
      { type: 'terminal', name: 'repro', grid: { x: 0, y: 5, w: 7, h: 4 }, canvas: { x: 20,  y: 340, w: 560, h: 240 } },
      { type: 'files',    name: 'dumps', grid: { x: 7, y: 5, w: 5, h: 4 }, canvas: { x: 600, y: 340, w: 400, h: 240 } },
    ],
  },
  {
    id: 'writing',
    name: 'Writing',
    description: 'Large notes editor with a browser for references.',
    icon: '#',
    accent: '#f1fa8c',
    panels: [
      { type: 'notes',   name: 'Draft',     grid: { x: 0, y: 0, w: 8, h: 9 }, canvas: { x: 20,  y: 20, w: 680, h: 560 } },
      { type: 'browser', name: 'Reference', grid: { x: 8, y: 0, w: 4, h: 9 }, canvas: { x: 720, y: 20, w: 360, h: 560 } },
    ],
  },
  {
    id: 'learning',
    name: 'Learning',
    description: 'Browser tutorial, terminal to try things, notes to summarize.',
    icon: 'L',
    accent: '#8be9fd',
    panels: [
      { type: 'browser',  name: 'Tutorial', grid: { x: 0, y: 0, w: 7, h: 9 }, canvas: { x: 20,  y: 20,  w: 600, h: 560 } },
      { type: 'terminal', name: 'Try',      grid: { x: 7, y: 0, w: 5, h: 5 }, canvas: { x: 640, y: 20,  w: 420, h: 300 } },
      { type: 'notes',    name: 'Learned',  grid: { x: 7, y: 5, w: 5, h: 4 }, canvas: { x: 640, y: 340, w: 420, h: 240 } },
    ],
  },
];

export const getTemplate = (id) => TEMPLATES.find((t) => t.id === id) || null;
