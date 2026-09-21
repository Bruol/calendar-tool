"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { parseICS, type CalendarEvent } from "@/lib/ics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = ["#2563eb", "#e05a3f", "#15936f", "#8b5cf6", "#d49814", "#e23d82"];
const STORAGE_KEY = "hours-calendar-subscriptions";

interface SourcedEvent extends CalendarEvent {
  calendarId: string;
  calendarName: string;
  calendarColor: string;
}

interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color: string;
  events: SourcedEvent[];
  error?: string;
}

type CalendarSubscription = Pick<CalendarSource, "id" | "name" | "url" | "color">;

const hours = (event: CalendarEvent) => (new Date(event.end).getTime() - new Date(event.start).getTime()) / 3_600_000;
const duration = (event: CalendarEvent) => `${Number.isInteger(hours(event)) ? hours(event).toFixed(0) : hours(event).toFixed(1)}h`;
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

async function fetchCalendar(subscription: CalendarSubscription): Promise<CalendarSource> {
  try {
    const response = await fetch("/api/fetch-ics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: subscription.url }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not fetch this calendar.");
    const parsed = parseICS(result.content);
    if (!parsed.length) throw new Error("No valid events found.");
    return {
      ...subscription,
      events: parsed.map((event) => ({
        ...event,
        calendarId: subscription.id,
        calendarName: subscription.name,
        calendarColor: subscription.color,
      })),
    };
  } catch (caught) {
    return { ...subscription, events: [], error: caught instanceof Error ? caught.message : "Refresh failed." };
  }
}

function saveSubscriptions(calendars: CalendarSource[]) {
  const subscriptions: CalendarSubscription[] = calendars.map(({ id, name, url, color }) => ({ id, name, url, color }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

export default function VersionedApp() {
  const [calendars, setCalendars] = useState<CalendarSource[]>([]);
  const [calendarName, setCalendarName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [monthIndex, setMonthIndex] = useState(0);
  const [selected, setSelected] = useState<SourcedEvent | null>(null);
  const events = useMemo(() => calendars.flatMap((calendar) => calendar.events), [calendars]);

  const grouped = useMemo(() => events.reduce((all, event) => {
    const date = new Date(event.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    (all[key] ||= []).push(event);
    return all;
  }, {} as Record<string, SourcedEvent[]>), [events]);
  const currentMonth = monthKey(new Date());
  const months = useMemo(() => Array.from(new Set([...Object.keys(grouped), currentMonth])).sort(), [currentMonth, grouped]);
  const key = months[monthIndex];
  const monthEvents = key ? grouped[key] || [] : [];
  const [year, month] = key?.split("-").map(Number) || [];
  const monthName = key ? new Date(year, month - 1).toLocaleDateString([], { month: "long", year: "numeric" }) : "";
  const total = monthEvents.reduce((sum, event) => sum + hours(event), 0);

  useEffect(() => {
    setMonthIndex(months.indexOf(currentMonth));
    setSelected(null);
  }, [currentMonth, months]);

  useEffect(() => {
    let cancelled = false;
    const refreshSavedCalendars = async () => {
      setCalendars([]);
      setMonthIndex(0);
      setSelected(null);
      setError("");

      let subscriptions: CalendarSubscription[] = [];
      try {
        subscriptions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (!subscriptions.length) return;

      setLoading(true);
      const refreshed = await Promise.all(subscriptions.map(fetchCalendar));
      if (!cancelled) {
        setCalendars(refreshed);
        setLoading(false);
      }
    };
    void refreshSavedCalendars();
    return () => { cancelled = true; };
  }, []);

  const addCalendar = async () => {
    const name = calendarName.trim();
    const calendarUrl = url.trim();
    if (!name || !calendarUrl) return;
    try { new URL(calendarUrl); } catch { return setError("Enter a valid calendar URL."); }
    setLoading(true); setError("");
    const subscription: CalendarSubscription = {
      id: crypto.randomUUID(),
      name,
      url: calendarUrl,
      color: COLORS[calendars.length % COLORS.length],
    };
    const source = await fetchCalendar(subscription);
    setCalendars((current) => {
      const next = [...current, source];
      saveSubscriptions(next);
      return next;
    });
    setCalendarName(""); setUrl(""); setLoading(false);
  };
  const removeCalendar = (id: string) => {
    setCalendars((current) => {
      const next = current.filter((calendar) => calendar.id !== id);
      saveSubscriptions(next);
      return next;
    });
    setSelected(null);
  };
  const exportCsv = () => {
    const rows = [["Calendar", "Summary", "Start", "End", "Hours", "Location"], ...events.map((event) => [event.calendarName, event.summary, event.start, event.end, duration(event), event.location || ""] )];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a"); link.href = href; link.download = "calendar-hours.csv"; link.click(); URL.revokeObjectURL(href);
  };

  const calendarCells = () => {
    if (!key) return null;
    const first = new Date(year, month - 1, 1).getDay();
    const count = new Date(year, month, 0).getDate();
    const cells = Array.from({ length: first }, (_, index) => <div className="vday vday-empty" key={`e${index}`} />);
    for (let day = 1; day <= count; day++) {
      const items = monthEvents.filter((event) => new Date(event.start).getDate() === day);
      cells.push(<div className="vday" key={day}><span className="vdaynum">{day}</span>{items.map((event, index) => <button style={{ "--calendar-color": event.calendarColor } as CSSProperties} onClick={() => setSelected(event)} key={index}><b>{event.summary}</b><small>{time(event.start)} · {duration(event)}</small></button>)}</div>);
    }
    return cells;
  };

  return (
    <main className="vapp v1">
      <header className="vtop">
        <Link href="/" className="vbrand">Hours</Link>
      </header>

      <div className="vintro"><p>Calendar hours</p><h1>Hours at a glance</h1><span>{calendars.length ? `${calendars.length} calendar${calendars.length === 1 ? "" : "s"} · ${events.length} events` : "Add calendar subscriptions to get started"}</span></div>

      <div className={`vbody ${events.length ? "has-events" : ""}`}>
        <section className="vimport">
          <div className="vsection-title"><b>Add calendar</b><span>ICS subscription</span></div>
          <div className="vurl vurl-multiple">
            <div className="vurl-fields">
              <label><span>Name / tag</span><input aria-label="Calendar name" value={calendarName} onChange={(event) => setCalendarName(event.target.value)} placeholder="Work" /></label>
              <label><span>Calendar URL</span><input aria-label="Calendar URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…/calendar.ics" /></label>
            </div>
            <button disabled={!calendarName.trim() || !url.trim() || loading} onClick={() => void addCalendar()}>{loading ? "Refreshing…" : "Add calendar"}</button>
          </div>
          {error && <p className="verror">{error}</p>}
          {calendars.length > 0 && <div className="vsource-list"><span>Calendar subscriptions</span>{calendars.map((calendar) => <div className={calendar.error ? "has-error" : ""} key={calendar.id}><i style={{ background: calendar.color }} /><b title={`${calendar.name} — ${calendar.url}`}>{calendar.name}</b><small title={calendar.error}>{calendar.error || `${calendar.events.length} events`}</small><button aria-label={`Remove ${calendar.name}`} onClick={() => removeCalendar(calendar.id)}>×</button></div>)}</div>}
        </section>

        {!events.length ? (
          <section className="vempty"><div><span>1</span><b>Add subscriptions</b><p>Name each ICS URL so it stays identifiable.</p></div><div><span>2</span><b>Always current</b><p>Saved URLs are fetched again whenever the page loads.</p></div><div><span>3</span><b>Review & export</b><p>Combine fresh events and download the result.</p></div></section>
        ) : (
          <section className="vresults">
            <div className="vsummary">
              <button disabled={monthIndex === 0} onClick={() => setMonthIndex((value) => value - 1)}>←</button>
              <div><span>Month</span><h2>{monthName}</h2></div>
              <div className="vmetric"><strong>{total.toFixed(1)}</strong><span>hours</span></div>
              <div className="vmetric"><strong>{monthEvents.length}</strong><span>events</span></div>
              <button disabled={monthIndex === months.length - 1} onClick={() => setMonthIndex((value) => value + 1)}>→</button>
              <button className="vexport" onClick={exportCsv}>Export CSV</button>
            </div>
            <div className="vcalendar"><div className="vweek">{DAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="vgrid">{calendarCells()}</div></div>
            <div className="vagenda">
              {monthEvents.slice().sort((a,b) => +new Date(a.start) - +new Date(b.start)).map((event,index) => <button style={{ "--calendar-color": event.calendarColor } as CSSProperties} onClick={() => setSelected(event)} key={index}><time><b>{new Date(event.start).getDate()}</b>{new Date(event.start).toLocaleDateString([], { month:"short" })}</time><span><b>{event.summary}</b><small><i style={{ background:event.calendarColor }} />{event.calendarName} · {time(event.start)}–{time(event.end)}</small></span><strong>{duration(event)}</strong></button>)}
            </div>
          </section>
        )}
      </div>

      {selected && <div className="vmodal" onMouseDown={() => setSelected(null)}><article onMouseDown={(event) => event.stopPropagation()}><button aria-label="Close" onClick={() => setSelected(null)}>×</button><span><i style={{ background:selected.calendarColor }} />{selected.calendarName}</span><h2>{selected.summary}</h2><strong>{duration(selected)}</strong><p>{new Date(selected.start).toLocaleDateString([], { weekday:"long", day:"numeric", month:"long" })}<br />{time(selected.start)}–{time(selected.end)}</p>{selected.location && <small>{selected.location}</small>}</article></div>}
    </main>
  );
}
