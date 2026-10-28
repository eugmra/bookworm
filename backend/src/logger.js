function write(level, msg, extra = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }) + '\n';
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line);
}

// Never pass passwords, tokens, card data or other PII in `extra`.
export const logger = {
  debug: (msg, extra) => write('debug', msg, extra),
  info: (msg, extra) => write('info', msg, extra),
  warn: (msg, extra) => write('warn', msg, extra),
  error: (msg, extra) => write('error', msg, extra),
};
