export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

function unescapeText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function formatDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, utc] = match;
  if (!hour) return `${year}-${month}-${day}`;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${utc || ""}`;
}

export function parseICS(content: string): CalendarEvent[] {
  // RFC 5545 permits long property values to continue on a line beginning
  // with a space or tab. Unfold those lines before reading the properties.
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");

  const events: CalendarEvent[] = [];
  let properties: Map<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      properties = new Map();
      continue;
    }

    if (line === "END:VEVENT") {
      if (properties) {
        const start = formatDate(properties.get("DTSTART") || "");
        const end = formatDate(properties.get("DTEND") || "");

        // Do not pass malformed dates into the calendar renderer. Invalid
        // Date objects otherwise create unusable month groups.
        if (start && end) {
          const event: CalendarEvent = {
            summary: unescapeText(properties.get("SUMMARY") || ""),
            start,
            end,
          };
          const description = properties.get("DESCRIPTION");
          const location = properties.get("LOCATION");
          if (description !== undefined) event.description = unescapeText(description);
          if (location !== undefined) event.location = unescapeText(location);
          events.push(event);
        }
      }
      properties = null;
      continue;
    }

    if (!properties) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    // Parameters such as VALUE=DATE and TZID=Europe/Zurich are metadata for
    // the property; the property name itself is the part before the first ';'.
    const name = line.slice(0, separator).split(";", 1)[0];
    if (!properties.has(name)) {
      properties.set(name, line.slice(separator + 1));
    }
  }

  return events;
}
