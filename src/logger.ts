type LogFields = Record<string, unknown>;

function format(level: string, message: string, fields?: LogFields): string {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(message: string, fields?: LogFields): void {
    console.log(format("info", message, fields));
  },
  warn(message: string, fields?: LogFields): void {
    console.warn(format("warn", message, fields));
  },
  error(message: string, fields?: LogFields): void {
    console.error(format("error", message, fields));
  },
};
