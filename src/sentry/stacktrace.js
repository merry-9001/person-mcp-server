export function formatEventStacktrace(event) {
  const exceptions = extractExceptions(event);
  if (!exceptions.length) {
    const message = event?.message || event?.title || 'No stacktrace in latest event.';
    return String(message);
  }

  return exceptions
    .map((item, index) => formatException(item, index))
    .join('\n\n');
}

function extractExceptions(event) {
  if (!event || typeof event !== 'object') {
    return [];
  }

  if (Array.isArray(event.exceptions)) {
    return event.exceptions;
  }

  const fromEntries = (event.entries || [])
    .filter((entry) => entry.type === 'exception')
    .flatMap((entry) => entry.data?.values || []);

  if (fromEntries.length) {
    return fromEntries;
  }

  if (event.exception) {
    return [event.exception];
  }

  return [];
}

function formatException(exception, index) {
  const header = `[${index + 1}] ${exception.type || 'Error'}: ${exception.value || ''}`.trim();
  const frames = exception.stacktrace?.frames || [];
  if (!frames.length) {
    return header;
  }

  const lines = frames
    .slice()
    .reverse()
    .map((frame) => {
      const location = [
        frame.absPath || frame.filename || frame.module || '?',
        frame.lineNo ?? frame.lineno,
        frame.colNo ?? frame.colno
      ]
        .filter((part) => part !== undefined && part !== null && part !== '')
        .join(':');
      const fn = frame.function ? ` in ${frame.function}` : '';
      const inApp = frame.inApp ? ' [inApp]' : '';
      const context = frame.contextLine ? `\n      > ${frame.contextLine.trim()}` : '';
      return `  at ${location}${fn}${inApp}${context}`;
    });

  return `${header}\n${lines.join('\n')}`;
}

export function formatEventTags(event) {
  const tags = event?.tags || [];
  if (!tags.length) {
    return '-';
  }

  return tags.map((tag) => `${tag.key}=${tag.value}`).join(', ');
}
