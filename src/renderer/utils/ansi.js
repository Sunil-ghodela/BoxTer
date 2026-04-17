// Strip common ANSI escape sequences and normalize line endings, so terminal
// output can be piped into a plain-text notes panel.
//
// Covers CSI (ESC [ ...), OSC (ESC ] ... BEL|ST), single-char escapes, and
// drops stray C0 control chars except \n and \t.

const CSI   = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OSC   = /\x1b\][^\x07]*(?:\x07|\x1b\\)/g;
const SSET  = /\x1b[@-Z\\-_]/g;
const CTRL  = /[\x00-\x08\x0b-\x1f\x7f]/g;

export function stripAnsi(input) {
  if (!input) return '';
  return String(input)
    .replace(OSC, '')
    .replace(CSI, '')
    .replace(SSET, '')
    .replace(CTRL, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
