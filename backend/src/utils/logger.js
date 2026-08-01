/**
 * @file backend/src/utils/logger.js
 * @description Centralized colored logger utility for NeuroSyn-Math.
 */

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  _format(level, msg, meta) {
    const ts = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    return `[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`;
  }

  info(msg, meta = {}) {
    console.log(`\x1b[36m${this._format('info', msg, meta)}\x1b[0m`);
  }

  warn(msg, meta = {}) {
    console.warn(`\x1b[33m${this._format('warn', msg, meta)}\x1b[0m`);
  }

  error(msg, meta = {}) {
    console.error(`\x1b[31m${this._format('error', msg, meta)}\x1b[0m`);
  }

  debug(msg, meta = {}) {
    if (!this.isProduction || process.env.LOG_LEVEL === 'debug') {
      console.log(`\x1b[90m${this._format('debug', msg, meta)}\x1b[0m`);
    }
  }
}

const logger = new Logger();
export default logger;
