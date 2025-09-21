"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

import {
  Users,
  Heart,
  Send,
  BarChart2,
  Smile,
  Frown,
  Angry,
  Moon,
  HelpCircle,
  PartyPopper,
  X,
  Clock,
  Filter,
  Layers,
} from "lucide-react";

/* ----------------------------
   CONFIG: emotions + colors
   ---------------------------- */
const EMOTIONS = [
  { id: "happy", label: "Happy", icon: Smile, color: "#F6C85F" },
  { id: "sad", label: "Sad", icon: Frown, color: "#6FA8DC" },
  { id: "angry", label: "Angry", icon: Angry, color: "#F26B6B" },
  { id: "tired", label: "Tired", icon: Moon, color: "#9B8CE0" },
  { id: "thoughtful", label: "Thoughtful", icon: HelpCircle, color: "#7AC89A" },
  { id: "excited", label: "Excited", icon: PartyPopper, color: "#FF8DAA" },
] as const;

type Emotion = (typeof EMOTIONS)[number];

type Submission = {
  position: [number, number];
  mood: string;
  emotionId: string;
  timestamp: string;
};

type TimeFilter = "all" | "24h" | "week" | "month";

/* ----------------------------
   HELPER: create SVG-based divIcon
   ---------------------------- */
function createSvgIcon(label: string, color: string, size = 34) {
  const circleR = size / 2 - 2;
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
      <defs>
        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.15"/>
        </filter>
      </defs>
      <g filter="url(#s)">
        <circle cx="${size / 2}" cy="${
      size / 2
    }" r="${circleR}" fill="${color}" stroke="#fff" stroke-width="3"/>
      </g>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" font-size="${Math.round(
        size * 0.4
      )}" font-weight="600" fill="#2c2c2c">${label}</text>
    </svg>`
  );
  const dataUrl = `data:image/svg+xml;charset=utf-8,${svg}`;
  return L.divIcon({
    html: `<img src="${dataUrl}" style="width:${size}px;height:${size}px;display:block" alt="${label}" />`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ----------------------------
   Map panner hook
   ---------------------------- */
function MapPanner({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    const zoom = Math.max(map.getZoom(), 4);
    map.flyTo(center, zoom, { duration: 2 });
  }, [center, map]);
  return null;
}

/* ----------------------------
   Heatmap Layer Component
   ---------------------------- */
function HeatmapLayer({
  data,
  showHeatmap,
}: {
  data: Submission[];
  showHeatmap: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    let heatLayer = null;

    if (showHeatmap && data.length > 0) {
      const heatPoints = data.map((submission) => {
        const intensity = 1.0; // Fixed high intensity for testing
        return [submission.position[0], submission.position[1], intensity];
      });

      heatLayer = L.heatLayer(heatPoints, {
        radius: 100, // Larger radius for visibility
        blur: 5, // Less blur for sharper spots
        maxZoom: 17,
        gradient: { 0.1: "red", 0.5: "red", 1.0: "red" }, // Single color for testing
      }).addTo(map);
    }

    return () => {
      if (heatLayer) {
        map.removeLayer(heatLayer);
      }
    };
  }, [map, data, showHeatmap]);

  return showHeatmap ? (
    <div className="sr-only">
      Heatmap showing density of mood submissions. Areas with more submissions
      appear brighter.
    </div>
  ) : null;
}

/* ----------------------------
   MAIN PAGE COMPONENT
   ---------------------------- */
export default function Page() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return [
      {
        position: [40.7128, -74.006],
        mood: "Beautiful day in the city, feeling energized!",
        emotionId: "happy",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        position: [51.5074, -0.1278],
        mood: "Rainy weather has me feeling contemplative",
        emotionId: "sad",
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        position: [35.6762, 139.6503],
        mood: "Late night coding session, so tired but productive",
        emotionId: "tired",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        position: [48.8566, 2.3522],
        mood: "Just got promoted at work! Can't contain my excitement",
        emotionId: "excited",
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
      {
        position: [55.8566, 55.3522],
        mood: "Just had a disagreement with a friend, feeling a bit angry",
        emotionId: "angry",
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      },
      {
        position: [34.0522, -118.2437],
        mood: "Perfect weather for a beach day!",
        emotionId: "happy",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
      {
        position: [37.7749, -122.4194],
        mood: "Busy day at work, feeling overwhelmed",
        emotionId: "sad",
        timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
      {
        position: [41.8781, -87.6298],
        mood: "Deep in thought about life decisions",
        emotionId: "thoughtful",
        timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      // Additional submissions for heatmap density
      {
        position: [40.7128, -74.0061],
        mood: "Enjoying a coffee in the city!",
        emotionId: "happy",
        timestamp: new Date().toISOString(),
      },
      {
        position: [40.7129, -74.0062],
        mood: "Feeling great after a run!",
        emotionId: "excited",
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
    ];
  });

  const [selectedEmotionId, setSelectedEmotionId] = useState<string>(
    EMOTIONS[0].id
  );
  const [moodText, setMoodText] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [selectedEmotions, setSelectedEmotions] = useState<Set<string>>(
    new Set(EMOTIONS.map((e) => e.id))
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showHeatmap, setShowHeatmap] = useState(false);

  const emotionMap = useMemo(() => {
    const m = new Map<string, Emotion>();
    EMOTIONS.forEach((e) => m.set(e.id, e));
    return m;
  }, []);

  // Filtered submissions based on emotion and time filters
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      // Filter by emotion
      if (!selectedEmotions.has(submission.emotionId)) {
        return false;
      }

      // Filter by time
      if (timeFilter !== "all") {
        const now = Date.now();
        const submissionTime = new Date(submission.timestamp).getTime();
        const timeDiff = now - submissionTime;

        switch (timeFilter) {
          case "24h":
            if (timeDiff > 24 * 60 * 60 * 1000) return false;
            break;
          case "week":
            if (timeDiff > 7 * 24 * 60 * 60 * 1000) return false;
            break;
          case "month":
            if (timeDiff > 30 * 24 * 60 * 60 * 1000) return false;
            break;
        }
      }

      return true;
    });
  }, [submissions, selectedEmotions, timeFilter]);

  const stats = useMemo(() => {
    const total = filteredSubmissions.length;
    const active = Math.max(1, Math.floor(total * 0.7));
    let top = "—";
    if (total > 0) {
      const counts = new Map<string, number>();
      for (const s of filteredSubmissions)
        counts.set(s.emotionId, (counts.get(s.emotionId) || 0) + 1);
      let max = 0;
      counts.forEach((n, id) => {
        if (n > max) {
          max = n;
          top = emotionMap.get(id)?.label ?? top;
        }
      });
    }
    return { total, active, top };
  }, [filteredSubmissions, emotionMap]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    let mounted = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mounted) return;
        const coords: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        setUserLocation(coords);
        setMapCenter(coords);
      },
      (err) => {
        console.warn("Geolocation failed:", err?.message ?? err);
      },
      { maximumAge: 60_000 * 5 }
    );
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = () => {
    if (!moodText.trim())
      return alert("Please add a description of your mood.");
    if (!userLocation)
      return alert(
        "Location access required. Please allow location and try again."
      );

    const newSub: Submission = {
      position: userLocation,
      mood: moodText.trim(),
      emotionId: selectedEmotionId,
      timestamp: new Date().toISOString(),
    };
    setSubmissions((p) => [...p, newSub]);
    setMoodText("");
    setShowForm(false);
    setMapCenter(userLocation);
  };

  const getIconFor = (emotionId: string) => {
    const em = emotionMap.get(emotionId);
    const label = em ? em.label[0].toUpperCase() : "•";
    const color = em ? em.color : "#999";
    return createSvgIcon(label, color, 38);
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleEmotionToggle = (emotionId: string) => {
    const newSelected = new Set(selectedEmotions);
    if (newSelected.has(emotionId)) {
      newSelected.delete(emotionId);
    } else {
      newSelected.add(emotionId);
    }
    setSelectedEmotions(newSelected);
  };

  const getTimeFilterLabel = (filter: TimeFilter) => {
    switch (filter) {
      case "all":
        return "All Time";
      case "24h":
        return "Last 24 Hours";
      case "week":
        return "Last Week";
      case "month":
        return "Last Month";
      default:
        return "All Time";
    }
  };

  return (
    <div className="w-full h-screen bg-gray-50 text-gray-900 antialiased relative">
      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
            G
          </div>
          <div className="text-lg font-semibold">Global Mood Map</div>
          <div className="hidden sm:block px-2 py-1 bg-gray-100 rounded text-xs font-medium">
            {filteredSubmissions.length} moods{" "}
            {selectedEmotions.size < EMOTIONS.length || timeFilter !== "all"
              ? "filtered"
              : "shared"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors ${
              showStats
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Stats</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showForm
                ? "bg-gray-900 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">Share Mood</span>
          </button>
        </div>
      </header>

      {/* Map Container */}
      <main className="relative h-[calc(100vh-64px)]">
        <div className="absolute inset-0 z-10">
          <MapContainer
            center={mapCenter}
            zoom={userLocation ? 6 : 2}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapPanner center={mapCenter} />
            <HeatmapLayer
              data={filteredSubmissions}
              showHeatmap={showHeatmap}
            />

            {userLocation && (
              <Marker
                position={userLocation}
                icon={createSvgIcon("U", "#1f2937", 36)}
              >
                <Popup>
                  <div className="min-w-[160px] p-1">
                    <div className="font-semibold">Your location</div>
                    <div className="text-sm text-gray-600 mt-1">
                      You can submit your mood from here
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {!showHeatmap &&
              filteredSubmissions.map((s, i) => (
                <Marker
                  key={i}
                  position={s.position}
                  icon={getIconFor(s.emotionId)}
                >
                  <Popup>
                    <div className="min-w-[200px] p-1">
                      <div className="font-semibold text-base mb-2">
                        {emotionMap.get(s.emotionId)?.label}
                      </div>
                      <div className="text-gray-800 mb-2">{s.mood}</div>
                      <div className="text-xs text-gray-500">
                        {formatTimeAgo(s.timestamp)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
        {/* Stats Panel */}
        {showStats && (
          <div className="absolute top-4 right-4 z-40 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <div className="font-semibold">Community Stats</div>
                </div>
                <button
                  onClick={() => setShowStats(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </div>
                  <div className="text-sm text-gray-600">Total Moods</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.active}
                  </div>
                  <div className="text-sm text-gray-600">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {stats.top}
                  </div>
                  <div className="text-sm text-gray-600">Top Emotion</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Recent Activity
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {filteredSubmissions
                    .slice(-8)
                    .reverse()
                    .map((s, i) => {
                      const emotion = emotionMap.get(s.emotionId);
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-2 bg-gray-50 rounded"
                        >
                          <div
                            className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-white"
                            style={{
                              backgroundColor: emotion?.color || "#999",
                            }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {emotion?.label}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {s.mood}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatTimeAgo(s.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Share Form Panel */}
        {showForm && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 w-[95%] max-w-lg bg-white border border-gray-200 rounded-lg shadow-xl">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  <div className="font-semibold">Share Your Mood</div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  How are you feeling?
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmotionId(e.id)}
                      className={`flex items-center gap-2 p-2 rounded-md border text-sm font-medium transition-colors ${
                        selectedEmotionId === e.id
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <e.icon className="w-4 h-4" />
                      <span>{e.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  What&apos;s on your mind?
                </div>
                <textarea
                  value={moodText}
                  onChange={(ev) => setMoodText(ev.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Share what's making you feel this way..."
                  className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {moodText.length}/280
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setMoodText("");
                    setSelectedEmotionId(EMOTIONS[0].id);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!moodText.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Share Mood
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Recent Moods Toggle */}
        <div className="absolute bottom-4 left-4 z-40">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md shadow-lg font-medium text-sm transition-colors ${
              showRecent
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Recent</span>
          </button>

          {showRecent && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl">
              <div className="p-3 border-b border-gray-100">
                <div className="font-semibold text-sm">Recent Moods</div>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {filteredSubmissions
                    .slice(-6)
                    .reverse()
                    .map((s, i) => {
                      const emotion = emotionMap.get(s.emotionId);
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => setMapCenter(s.position)}
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: emotion?.color || "#999",
                            }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              {emotion?.label}
                            </div>
                            <div className="text-xs text-gray-600 truncate">
                              {s.mood}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTimeAgo(s.timestamp)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Filter Toggle */}
        <div className="absolute bottom-4 right-4 z-40">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md shadow-lg font-medium text-sm transition-colors ${
              showFilters
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
            aria-label="Toggle filters and view options"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {showFilters && (
            <div className="absolute bottom-full right-0 mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <div className="font-semibold">Filters & View</div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* View Toggle */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    View Mode
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHeatmap(!showHeatmap)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        showHeatmap
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>{showHeatmap ? "Heatmap" : "Markers"}</span>
                    </button>
                    {showHeatmap && (
                      <div className="text-xs text-gray-500 ml-2">
                        Density visualization based on mood intensity and
                        recency
                      </div>
                    )}
                  </div>
                </div>

                {/* Time Filter */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Time Range
                  </div>
                  <select
                    value={timeFilter}
                    onChange={(e) =>
                      setTimeFilter(e.target.value as TimeFilter)
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="week">Last Week</option>
                    <option value="month">Last Month</option>
                  </select>
                </div>

                {/* Emotion Filters */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Emotions ({selectedEmotions.size}/{EMOTIONS.length}{" "}
                    selected)
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() =>
                          setSelectedEmotions(
                            new Set(EMOTIONS.map((e) => e.id))
                          )
                        }
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setSelectedEmotions(new Set())}
                        className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                    {EMOTIONS.map((emotion) => (
                      <label
                        key={emotion.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmotions.has(emotion.id)}
                          onChange={() => handleEmotionToggle(emotion.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: emotion.color }}
                        ></div>
                        <div className="flex items-center gap-2 flex-1">
                          <emotion.icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium">
                            {emotion.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {
                            filteredSubmissions.filter(
                              (s) => s.emotionId === emotion.id
                            ).length
                          }
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Filter Summary */}
                {(selectedEmotions.size < EMOTIONS.length ||
                  timeFilter !== "all") && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-2">
                      Showing {filteredSubmissions.length} of{" "}
                      {submissions.length} moods
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {timeFilter !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                          <Clock className="w-3 h-3" />
                          {getTimeFilterLabel(timeFilter)}
                        </span>
                      )}
                      {selectedEmotions.size < EMOTIONS.length && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md">
                          <Filter className="w-3 h-3" />
                          {selectedEmotions.size} emotions
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
