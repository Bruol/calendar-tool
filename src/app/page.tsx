"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseICS, type CalendarEvent } from "@/lib/ics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function durationInHours(event: CalendarEvent) {
  return (new Date(event.end).getTime() - new Date(event.start).getTime()) / 3_600_000;
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const groupedEvents = useMemo(
    () =>
      events.reduce((groups, event) => {
        const date = new Date(event.start);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        (groups[key] ||= []).push(event);
        return groups;
      }, {} as Record<string, CalendarEvent[]>),
    [events]
  );

  const months = useMemo(() => Object.keys(groupedEvents).sort(), [groupedEvents]);
  const activeMonthKey = months[currentMonthIndex];
  const monthEvents = activeMonthKey ? groupedEvents[activeMonthKey] : [];
  const [activeYear, activeMonth] = activeMonthKey?.split("-").map(Number) || [];
  const monthName = activeMonthKey
    ? new Date(activeYear, activeMonth - 1).toLocaleString("default", { month: "long", year: "numeric" })
    : "";
  const totalHours = monthEvents.reduce((sum, event) => sum + durationInHours(event), 0);

  const importContent = useCallback((content: string) => {
    const parsed = parseICS(content);
    if (parsed.length === 0) throw new Error("No calendar events with valid start and end times were found.");
    setEvents(parsed);
    setCurrentMonthIndex(0);
  }, []);

  const handleUrlImport = useCallback(async (urlToFetch?: string) => {
    const urlToUse = urlToFetch || url;
    if (!urlToUse) return setError("Enter a calendar URL to continue.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/fetch-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToUse }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The calendar could not be fetched.");
      importContent(result.content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The calendar could not be imported.");
    } finally {
      setLoading(false);
    }
  }, [importContent, url]);

  useEffect(() => {
    const savedUrl = document.cookie.split("; ").find((row) => row.startsWith("calendar_url="))?.split("=")[1];
    if (!savedUrl) return;
    const decodedUrl = decodeURIComponent(savedUrl);
    setUrl(decodedUrl);
    void handleUrlImport(decodedUrl);
    // Restore a saved URL only once when the app mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showExportModal) return;
    const reference = activeMonthKey ? new Date(activeYear, activeMonth - 1, 1) : new Date();
    setExportStartDate(formatDateInput(new Date(reference.getFullYear(), reference.getMonth(), 1)));
    setExportEndDate(formatDateInput(new Date(reference.getFullYear(), reference.getMonth() + 1, 0)));
  }, [activeMonth, activeMonthKey, activeYear, showExportModal]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `calendar_url=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/`;
  };

  const readFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      importContent(await file.text());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The ICS file could not be read.");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const start = new Date(`${exportStartDate}T00:00:00`);
    const end = new Date(`${exportEndDate}T23:59:59`);
    const rows = [["Summary", "Start Date", "End Date", "Hours", "Location", "Description"]];
    events
      .filter((event) => new Date(event.start) >= start && new Date(event.start) <= end)
      .forEach((event) => rows.push([
        event.summary,
        new Date(event.start).toLocaleString(),
        new Date(event.end).toLocaleString(),
        formatHours(durationInHours(event)),
        event.location || "",
        event.description || "",
      ]));
    const csv = rows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(",")).join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `hours-${exportStartDate}-to-${exportEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(href);
    setShowExportModal(false);
  };

  const renderCalendarDays = () => {
    if (!activeMonthKey) return null;
    const firstDay = new Date(activeYear, activeMonth - 1, 1).getDay();
    const daysInMonth = new Date(activeYear, activeMonth, 0).getDate();
    const cells = [];
    for (let index = 0; index < firstDay; index++) {
      cells.push(<div className="calendar-cell calendar-cell--empty" key={`empty-${index}`} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = monthEvents.filter((event) => new Date(event.start).getDate() === day);
      const dayHours = dayEvents.reduce((sum, event) => sum + durationInHours(event), 0);
      cells.push(
        <div className={`calendar-cell ${dayEvents.length ? "calendar-cell--active" : ""}`} key={day}>
          <div className="day-heading">
            <span className="day-number">{String(day).padStart(2, "0")}</span>
            {dayEvents.length > 0 && <span className="day-total">{formatHours(dayHours)}h</span>}
          </div>
          <div className="event-stack">
            {dayEvents.map((event, index) => (
              <button className="event-chip" key={`${event.start}-${index}`} onClick={() => setSelectedEvent(event)}>
                <span>{event.summary}</span><time>{formatTime(event.start)}</time>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setEvents([])} aria-label="Return to import">
          <span className="brand-mark"><i /><i /><i /></span><span>Hours</span>
        </button>
        <div className="topbar-note">Calendar → hours ledger</div>
        <div className={`status-pill ${events.length ? "status-pill--ready" : ""}`}>
          <span /> {events.length ? `${events.length} events loaded` : "Ready to import"}
        </div>
      </header>

      {!events.length ? (
        <section className="landing">
          <div className="hero-copy">
            <p className="eyebrow">A simpler calendar report</p>
            <h1>Turn calendar blocks into a clean hours ledger.</h1>
            <p className="hero-lede">Drop in an ICS calendar. See where the month went, total the hours, and take the numbers with you.</p>
            <div className="process-line" aria-label="Import process">
              <span><b>01</b> Import</span><i /><span><b>02</b> Review</span><i /><span><b>03</b> Export</span>
            </div>
          </div>

          <section className={`import-panel ${dragActive ? "import-panel--active" : ""}`}>
            <div className="panel-label"><span>Import calendar</span><span>ICS / iCal</span></div>
            <label
              className="drop-zone"
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => { event.preventDefault(); setDragActive(false); void readFile(event.dataTransfer.files?.[0]); }}
            >
              <input type="file" accept=".ics,text/calendar" onChange={(event) => void readFile(event.target.files?.[0])} />
              <span className="upload-glyph">↗</span>
              <strong>{loading ? "Reading calendar…" : "Drop your calendar here"}</strong>
              <small>or choose an .ics file</small>
            </label>
            <div className="url-divider"><span>or connect a URL</span></div>
            <div className="url-row">
              <input
                type="url" aria-label="Calendar URL" placeholder="https://calendar.example/file.ics"
                value={url} onChange={(event) => handleUrlChange(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleUrlImport()}
              />
              <button onClick={() => void handleUrlImport()} disabled={!url || loading}>Import</button>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <p className="privacy-note">Processed in your browser. Your uploaded file stays on this device.</p>
          </section>
        </section>
      ) : (
        <section className="workspace">
          <div className="workspace-heading">
            <div><p className="eyebrow">Monthly record</p><h1>{monthName}</h1></div>
            <div className="workspace-actions">
              <label className="button button--quiet">Replace calendar<input type="file" accept=".ics,text/calendar" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
              <button className="button button--dark" onClick={() => setShowExportModal(true)}>Export CSV ↗</button>
            </div>
          </div>
          {error && <p className="error-message error-message--workspace" role="alert">{error}</p>}
          <div className="ledger-strip">
            <button className="month-arrow" aria-label="Previous month" disabled={currentMonthIndex === 0} onClick={() => setCurrentMonthIndex((index) => Math.max(0, index - 1))}>←</button>
            <div className="hours-counter"><span className="counter-label">Hours logged</span><strong>{formatHours(totalHours)}</strong><span className="counter-unit">HRS</span></div>
            <div className="ledger-stat"><span>Entries</span><strong>{monthEvents.length}</strong></div>
            <div className="ledger-stat"><span>Active days</span><strong>{new Set(monthEvents.map((event) => new Date(event.start).toDateString())).size}</strong></div>
            <div className="month-position"><span>{String(currentMonthIndex + 1).padStart(2, "0")}</span> / {String(months.length).padStart(2, "0")}</div>
            <button className="month-arrow" aria-label="Next month" disabled={currentMonthIndex === months.length - 1} onClick={() => setCurrentMonthIndex((index) => Math.min(months.length - 1, index + 1))}>→</button>
          </div>
          <div className="calendar-wrap">
            <div className="calendar-weekdays">{DAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">{renderCalendarDays()}</div>
          </div>
          <div className="mobile-agenda">
            {monthEvents
              .slice()
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map((event, index) => (
                <button key={`${event.start}-${index}`} onClick={() => setSelectedEvent(event)}>
                  <time>
                    <strong>{new Date(event.start).toLocaleDateString([], { day: "2-digit" })}</strong>
                    {new Date(event.start).toLocaleDateString([], { month: "short" })}
                  </time>
                  <span><strong>{event.summary}</strong><small>{formatTime(event.start)} — {formatTime(event.end)}</small></span>
                  <b>{formatHours(durationInHours(event))}h</b>
                </button>
              ))}
          </div>
        </section>
      )}

      <footer><span>Hours / Calendar ledger</span><span>Local-first · CSV ready</span></footer>

      {selectedEvent && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedEvent(null)}>
          <section className="modal-card event-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-topline"><span>Calendar entry</span><button onClick={() => setSelectedEvent(null)} aria-label="Close">×</button></div>
            <h2>{selectedEvent.summary || "Untitled event"}</h2>
            <div className="event-time-block">
              <strong>{formatHours(durationInHours(selectedEvent))}</strong><span>hours</span>
              <p>{new Date(selectedEvent.start).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}<br />{formatTime(selectedEvent.start)} — {formatTime(selectedEvent.end)}</p>
            </div>
            {selectedEvent.location && <p className="event-meta"><span>Location</span>{selectedEvent.location}</p>}
            {selectedEvent.description && <p className="event-description">{selectedEvent.description}</p>}
          </section>
        </div>
      )}

      {showExportModal && (
        <div className="modal-backdrop" onMouseDown={() => setShowExportModal(false)}>
          <section className="modal-card" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-topline"><span>Export report</span><button onClick={() => setShowExportModal(false)} aria-label="Close">×</button></div>
            <h2>Choose a date range.</h2>
            <p className="modal-copy">Your CSV includes event names, times, hours, locations, and notes.</p>
            <div className="date-grid">
              <label>From<input type="date" value={exportStartDate} onChange={(event) => setExportStartDate(event.target.value)} /></label>
              <label>To<input type="date" value={exportEndDate} onChange={(event) => setExportEndDate(event.target.value)} /></label>
            </div>
            <button className="export-confirm" onClick={exportCSV}>Download CSV <span>↗</span></button>
          </section>
        </div>
      )}
    </main>
  );
}
