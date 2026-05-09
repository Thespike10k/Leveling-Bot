const COLORS = {
  DEBUG: '\x1b[90m',   // Gray
  INFO:  '\x1b[96m',   // Cyan (Bright)
  WARN:  ' \x1b[33m',  // Yellow
  ERROR: '\x1b[31m',   // Red
  SUCCESS: '\x1b[32m', // Green
  PURPLE: '\x1b[35m',  // Purple
  WHITE: '\x1b[97m',   // White
  BOLD: '\x1b[1m',
  RESET: '\x1b[0m'
};

const ICONS = {
  DEBUG: '⚙️ ',
  INFO:  '🔹',
  WARN:  '⚠️ ',
  ERROR: '❌',
  SUCCESS: '✅',
  STARTUP: '🚀'
};

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatLog(level, label, ...args) {
  const color = COLORS[level] || COLORS.WHITE;
  const icon = ICONS[level] || '▪️';
  const ts = `\x1b[90m${timestamp()}\x1b[0m`;
  const levelTag = `${color}${icon} ${level.padEnd(5)}${COLORS.RESET}`;
  const labelTag = label ? `${COLORS.BOLD}${COLORS.WHITE}[${label}]${COLORS.RESET} ` : '';
  
  return `${ts} ${levelTag} ${labelTag}${args.join(' ')}`;
}

export const logger = {
  debug: (msg, ...a) => console.log(formatLog('DEBUG', null, msg, ...a)),
  info:  (msg, ...a) => console.log(formatLog('INFO',  null, msg, ...a)),
  warn:  (msg, ...a) => console.log(formatLog('WARN',  null, msg, ...a)),
  error: (msg, ...a) => console.log(formatLog('ERROR', null, msg, ...a)),
  success: (msg, ...a) => console.log(formatLog('SUCCESS', null, msg, ...a)),
  
  tag: (label) => ({
    debug: (...a) => console.log(formatLog('DEBUG', label, ...a)),
    info:  (...a) => console.log(formatLog('INFO',  label, ...a)),
    warn:  (...a) => console.log(formatLog('WARN',  label, ...a)),
    error: (...a) => console.log(formatLog('ERROR', label, ...a)),
    success: (...a) => console.log(formatLog('SUCCESS', label, ...a)),
  }),
};
