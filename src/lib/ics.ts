import ICAL from "ical.js";

export interface CalendarEvent {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

/** Expand finite series in full; limit open-ended series to two years ahead. */
export function parseICS(content: string, now = new Date()): CalendarEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(content));
  const zones = calendar.getAllSubcomponents("vtimezone");
  for (const component of zones) {
    const zone = new ICAL.Timezone(component);
    ICAL.TimezoneService.register(zone);
  }

  try {
    const components = calendar.getAllSubcomponents("vevent");
    const exceptions = components.filter((component) => component.hasProperty("recurrence-id"));
    const events: CalendarEvent[] = [];
    const horizon = ICAL.Time.fromJSDate(new Date(now.getFullYear() + 3, 0, 1), true);
    const serialize = (value: ICAL.Time) => value.isDate || value.zone === ICAL.Timezone.localTimezone
      ? value.toString()
      : value.toJSDate().toISOString();

    for (const component of components) {
      if (component.hasProperty("recurrence-id") || !component.hasProperty("dtstart")) continue;
      const event = new ICAL.Event(component);
      if (component.getFirstPropertyValue("status") === "CANCELLED") continue;
      for (const exception of exceptions) {
        if (exception.getFirstPropertyValue("uid") === event.uid) event.relateException(new ICAL.Event(exception));
      }
      const append = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
        if (item.component.getFirstPropertyValue("status") === "CANCELLED") return;
        events.push({
          summary: item.summary || "",
          start: serialize(start),
          end: serialize(end),
          ...(item.description ? { description: item.description } : {}),
          ...(item.location ? { location: item.location } : {}),
        });
      };
      if (!event.isRecurring()) {
        append(event, event.startDate, event.endDate);
        continue;
      }
      const rules = component.getAllProperties("rrule").map((property) => property.getFirstValue() as ICAL.Recur);
      const openEnded = rules.some((rule) => !rule.until && !rule.count);
      // RDATE-only sets still include DTSTART under RFC 5545.
      if (!rules.length) component.addPropertyWithValue("rdate", event.startDate.clone());
      const iterator = event.iterator();
      // Bound expansion for pathological feeds as well as infinite rules.
      for (let count = 0; count < 100_000; count++) {
        const occurrence = iterator.next();
        if (!occurrence || (openEnded && occurrence.compare(horizon) >= 0)) break;
        const details = event.getOccurrenceDetails(occurrence);
        append(details.item, details.startDate, details.endDate);
      }
    }
    return events;
  } finally {
    for (const component of zones) {
      ICAL.TimezoneService.remove(String(component.getFirstPropertyValue("tzid")));
    }
  }
}
