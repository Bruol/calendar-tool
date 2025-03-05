"use client";

import { useState, useEffect, useCallback } from "react";

interface Event {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(0);

  const handleUrlImport = useCallback(
    async (urlToFetch?: string) => {
      const urlToUse = urlToFetch || url;
      if (!urlToUse) {
        setError("Please enter a calendar URL");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/fetch-ics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: urlToUse }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch ICS file");
        }

        const { content } = await response.json();
        const parsedEvents = parseICS(content);
        setEvents(parsedEvents);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to import calendar"
        );
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [url]
  );

  // Load saved URL from cookie on component mount
  useEffect(() => {
    const savedUrl = document.cookie
      .split("; ")
      .find((row) => row.startsWith("calendar_url="))
      ?.split("=")[1];

    if (savedUrl) {
      const decodedUrl = decodeURIComponent(savedUrl);
      setUrl(decodedUrl);
      // Automatically fetch the calendar data
      handleUrlImport(decodedUrl);
    }
  }, [handleUrlImport]);

  // Save URL to cookie whenever it changes
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    // Save to cookie with 1 year expiration
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    document.cookie = `calendar_url=${encodeURIComponent(
      newUrl
    )}; expires=${date.toUTCString()}; path=/`;
  };

  const parseICS = (content: string): Event[] => {
    const events: Event[] = [];
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    const matches = content.matchAll(eventRegex);

    for (const match of matches) {
      const eventContent = match[1];
      const event: Event = {
        summary: "",
        start: "",
        end: "",
      };

      // Extract summary
      const summaryMatch = eventContent.match(/SUMMARY:(.*)/);
      if (summaryMatch) event.summary = summaryMatch[1];

      // Extract start date
      const startMatch = eventContent.match(/DTSTART(?:;VALUE=DATE)?:(.*)/);
      if (startMatch) {
        const dateStr = startMatch[1];
        // Handle different date formats (YYYYMMDD or YYYYMMDDTHHmmssZ)
        if (dateStr.length === 8) {
          event.start = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)}`;
        } else {
          event.start = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)} ${dateStr.slice(9, 11)}:${dateStr.slice(
            11,
            13
          )}`;
        }
      }

      // Extract end date
      const endMatch = eventContent.match(/DTEND(?:;VALUE=DATE)?:(.*)/);
      if (endMatch) {
        const dateStr = endMatch[1];
        if (dateStr.length === 8) {
          event.end = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)}`;
        } else {
          event.end = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)} ${dateStr.slice(9, 11)}:${dateStr.slice(
            11,
            13
          )}`;
        }
      }

      // Extract description
      const descMatch = eventContent.match(/DESCRIPTION:(.*)/);
      if (descMatch) event.description = descMatch[1];

      // Extract location
      const locMatch = eventContent.match(/LOCATION:(.*)/);
      if (locMatch) event.location = locMatch[1];

      events.push(event);
    }

    return events;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const content = await file.text();
      const parsedEvents = parseICS(content);
      setEvents(parsedEvents);
    } catch (err) {
      setError("Error parsing ICS file");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const content = await file.text();
      const parsedEvents = parseICS(content);
      setEvents(parsedEvents);
    } catch (err) {
      setError("Error parsing ICS file");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Set default date range to current month when modal opens
  useEffect(() => {
    if (showExportModal) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      setExportStartDate(firstDay.toISOString().split("T")[0]);
      setExportEndDate(lastDay.toISOString().split("T")[0]);
    }
  }, [showExportModal]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ICS File Parser
          </h1>
          <p className="text-lg text-gray-600">
            Import your calendar events from an ICS file or Google Calendar
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 transform transition-all duration-300 hover:shadow-xl">
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-blue-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div className="text-gray-600">
                  <p className="text-lg font-medium">
                    Drag and drop your ICS file here
                  </p>
                  <p className="text-sm mt-1">or</p>
                  <div className="flex justify-center gap-4">
                    <label className="inline-block">
                      <span className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors duration-200">
                        Browse Files
                      </span>
                      <input
                        type="file"
                        accept=".ics"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Or import from URL
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <input
                type="url"
                placeholder="Enter ICS file URL"
                value={url}
                onChange={handleUrlChange}
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2 text-gray-900 placeholder-gray-500"
              />
              <button
                onClick={() => handleUrlImport()}
                disabled={!url || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Import
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center space-x-2 text-gray-600">
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Processing...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 transform transition-all duration-300 hover:shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                Events ({events.length})
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={() => setEvents([])}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Export Events
                    </h3>
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowExportModal(false)}
                        className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          // Filter events by date range
                          const filteredEvents = events.filter((event) => {
                            const eventDate = new Date(event.start);
                            const startDate = new Date(exportStartDate);
                            const endDate = new Date(exportEndDate);
                            return (
                              eventDate >= startDate && eventDate <= endDate
                            );
                          });

                          // Create CSV content
                          const headers = [
                            "Summary",
                            "Start Date",
                            "End Date",
                            "Location",
                            "Description",
                          ];
                          const csvRows = [headers];

                          filteredEvents.forEach((event) => {
                            const row = [
                              event.summary,
                              new Date(event.start).toLocaleString(),
                              new Date(event.end).toLocaleString(),
                              event.location || "",
                              event.description || "",
                            ].map((field) => `"${field.replace(/"/g, '""')}"`);

                            csvRows.push(row);
                          });

                          const csvContent = csvRows
                            .map((row) => row.join(","))
                            .join("\n");
                          const blob = new Blob([csvContent], {
                            type: "text/csv;charset=utf-8;",
                          });
                          const link = document.createElement("a");
                          const url = URL.createObjectURL(blob);

                          link.setAttribute("href", url);
                          link.setAttribute(
                            "download",
                            `calendar-events-${exportStartDate}-to-${exportEndDate}.csv`
                          );
                          link.style.visibility = "hidden";
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          setShowExportModal(false);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                      >
                        Export
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Group events by month */}
            {(() => {
              const groupedEvents = events.reduce((acc, event) => {
                const date = new Date(event.start);
                const monthKey = `${date.getFullYear()}-${String(
                  date.getMonth() + 1
                ).padStart(2, "0")}`;
                if (!acc[monthKey]) {
                  acc[monthKey] = [];
                }
                acc[monthKey].push(event);
                return acc;
              }, {} as Record<string, Event[]>);

              // Sort months chronologically
              const sortedMonths = Object.keys(groupedEvents).sort();

              // If no events, return early
              if (sortedMonths.length === 0) return null;

              // Find the current month's index
              const currentDate = new Date();
              const currentMonthKey = `${currentDate.getFullYear()}-${String(
                currentDate.getMonth() + 1
              ).padStart(2, "0")}`;
              const currentMonthIndex = sortedMonths.findIndex(
                (month) => month === currentMonthKey
              );

              // Get current month's events
              const monthKey =
                sortedMonths[currentMonthIndex >= 0 ? currentMonthIndex : 0];
              const [year, month] = monthKey.split("-");
              const monthEvents = groupedEvents[monthKey];
              const monthName = new Date(
                parseInt(year),
                parseInt(month) - 1
              ).toLocaleString("default", {
                month: "long",
                year: "numeric",
              });

              // Calculate total hours for the month
              const totalHours = monthEvents.reduce((acc, event) => {
                const start = new Date(event.start);
                const end = new Date(event.end);
                const duration =
                  (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Convert to hours
                return acc + duration;
              }, 0);

              return (
                <div>
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() =>
                        setCurrentMonthIndex((prev: number) =>
                          Math.max(0, prev - 1)
                        )
                      }
                      disabled={currentMonthIndex === 0}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous Month
                    </button>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {monthName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Total Hours: {totalHours.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setCurrentMonthIndex((prev: number) =>
                          Math.min(sortedMonths.length - 1, prev + 1)
                        )
                      }
                      disabled={currentMonthIndex === sortedMonths.length - 1}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Month
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Calendar Header */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                        (day) => (
                          <div
                            key={day}
                            className="py-2 text-center text-sm font-medium text-gray-500 border-r border-gray-200 last:border-r-0"
                          >
                            {day}
                          </div>
                        )
                      )}
                    </div>

                    {/* Calendar Body */}
                    <div className="grid grid-cols-7">
                      {(() => {
                        const year = parseInt(currentMonthKey.split("-")[0]);
                        const month =
                          parseInt(currentMonthKey.split("-")[1]) - 1;
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const startingDay = firstDay.getDay();
                        const totalDays = lastDay.getDate();
                        const days = [];

                        // Add empty cells for days before the first day of the month
                        for (let i = 0; i < startingDay; i++) {
                          days.push(
                            <div
                              key={`empty-${i}`}
                              className="h-32 bg-gray-50 border-r border-b border-gray-200 last:border-r-0"
                            />
                          );
                        }

                        // Add days of the month
                        for (let day = 1; day <= totalDays; day++) {
                          const dayEvents = monthEvents.filter((event) => {
                            const eventDate = new Date(event.start);
                            return eventDate.getDate() === day;
                          });

                          days.push(
                            <div
                              key={day}
                              className="h-32 p-2 bg-white hover:bg-gray-50 border-r border-b border-gray-200 last:border-r-0"
                            >
                              <div className="text-sm font-medium text-gray-900 mb-1">
                                {day}
                              </div>
                              <div className="space-y-1">
                                {dayEvents.map((event, index) => (
                                  <div
                                    key={index}
                                    className="text-xs p-1 bg-blue-50 text-blue-700 rounded truncate cursor-pointer hover:bg-blue-100"
                                    onClick={() => {
                                      const descElement =
                                        document.getElementById(
                                          `description-${event.start}-${index}`
                                        );
                                      if (descElement) {
                                        descElement.classList.toggle("hidden");
                                      }
                                    }}
                                  >
                                    {event.summary}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return days;
                      })()}
                    </div>
                  </div>

                  {/* Event Details Modal */}
                  {monthEvents.map((event, index) => (
                    <div
                      key={`${event.start}-${index}`}
                      id={`description-${event.start}-${index}`}
                      className="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                    >
                      <div className="bg-white rounded-lg max-w-lg w-full p-6">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-lg font-medium text-gray-900">
                            {event.summary}
                          </h4>
                          <button
                            onClick={() => {
                              const descElement = document.getElementById(
                                `description-${event.start}-${index}`
                              );
                              if (descElement) {
                                descElement.classList.toggle("hidden");
                              }
                            }}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 text-gray-600">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span>
                              {new Date(event.start).toLocaleDateString(
                                "default",
                                {
                                  weekday: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}{" "}
                              -{" "}
                              {new Date(event.end).toLocaleDateString(
                                "default",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center space-x-2 text-gray-600">
                              <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.description && (
                            <div className="mt-4 text-gray-700 bg-gray-50 rounded-lg p-4">
                              {event.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
