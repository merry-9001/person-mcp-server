export function csvResult(rows, metadata = {}) {
  const safeRows = rows || [];
  const headers = [...new Set(safeRows.flatMap((row) => Object.keys(row)))];
  const csv = [
    headers.join(','),
    ...safeRows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ].join('\n');

  return {
    content: [
      {
        type: 'text',
        text: `metadata=${JSON.stringify(metadata)}\n${csv}`
      }
    ]
  };
}

export function jsonResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value)
      }
    ]
  };
}

export function markdownResult(markdown) {
  return {
    content: [
      {
        type: 'text',
        text: markdown
      }
    ]
  };
}

function escapeCsv(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
