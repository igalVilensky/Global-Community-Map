"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { db } from "@/app/lib/firebase";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

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
  id: string;
  position: [number, number];
  mood: string;
  emotionId: string;
  timestamp: string;
  name?: string | null;
  continent?: string | null;
};

type TimeFilter = "all" | "24h" | "week" | "month";

/* ----------------------------
   HELPER: simplified continent lookup
   ---------------------------- */
function getContinentFromCoordinates(lat: number, lng: number): string | null {
  // Simplified bounding box data for continents (minLat, maxLat, minLng, maxLng)
  const continentBounds: { [key: string]: [number, number, number, number] } = {
    Africa: [-34.834, 37.0, -17.537, 51.414],
    Antarctica: [-85.051, -60.0, -180.0, 180.0],
    Asia: [0.0, 81.857, 26.0, 180.0],
    Australia: [-43.658, -10.689, 112.837, 153.639],
    Europe: [36.0, 71.0, -25.0, 45.0],
    "North America": [7.0, 83.336, -168.0, -52.0],
    "South America": [-55.0, 12.0, -81.0, -34.0],
  };

  for (const [continent, [minLat, maxLat, minLng, maxLng]] of Object.entries(
    continentBounds
  )) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return continent;
    }
  }
  return null;
}

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
   HELPER: generate fake global data
   ---------------------------- */
// function generateFakeSubmissions(): Submission[] {
//   const cities = [
//     { name: "New York", position: [40.7128, -74.006] },
//     { name: "London", position: [51.5074, -0.1278] },
//     { name: "Tokyo", position: [35.6762, 139.6503] },
//     { name: "Sydney", position: [-33.8688, 151.2093] },
//     { name: "Rio de Janeiro", position: [-22.9068, -43.1729] },
//     { name: "Cape Town", position: [-33.9249, 18.4241] },
//     { name: "Mumbai", position: [19.076, 72.8777] },
//     { name: "Beijing", position: [39.9042, 116.4074] },
//     { name: "Paris", position: [48.8566, 2.3522] },
//     { name: "Moscow", position: [55.7558, 37.6173] },
//     { name: "Mexico City", position: [19.4326, -99.1332] },
//     { name: "Bangkok", position: [13.7563, 100.5018] },
//     { name: "Lagos", position: [6.5244, 3.3792] },
//     { name: "Toronto", position: [43.6532, -79.3832] },
//     { name: "Dubai", position: [25.2048, 55.2708] },
//   ];

//   const moodTemplates = {
//     happy: ["Feeling great today!", "Loving life!", "So happy right now!"],
//     sad: ["Feeling down.", "Tough day.", "Missing something today."],
//     angry: ["So frustrated!", "Really annoyed right now.", "Angry about work."],
//     tired: ["Exhausted from work.", "Need a nap!", "So sleepy."],
//     thoughtful: ["Deep in thought.", "Reflecting on life.", "Contemplating."],
//     excited: ["Super pumped!", "Can't wait!", "So thrilled!"],
//   };

//   const names = [
//     "Alex",
//     "Sam",
//     "Taylor",
//     "Jordan",
//     "Casey",
//     "Morgan",
//     null,
//     null,
//     null,
//     null,
//   ];

//   const fakeSubmissions: Submission[] = [];
//   const now = Date.now();

//   cities.forEach((city) => {
//     for (let i = 0; i < 7; i++) {
//       const emotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];
//       const daysAgo = Math.random() * 30;
//       const timestamp = new Date(
//         now - daysAgo * 24 * 60 * 60 * 1000
//       ).toISOString();
//       const mood = moodTemplates[emotion.id][Math.floor(Math.random() * 3)];
//       const name = names[Math.floor(Math.random() * names.length)];
//       const continent = getContinentFromCoordinates(city.position[0], city.position[1]);

//       fakeSubmissions.push({
//         id: `fake-${city.name}-${i}`,
//         position: [
//           city.position[0] + (Math.random() - 0.5) * 0.1,
//           city.position[1] + (Math.random() - 0.5) * 0.1,
//         ],
//         mood,
//         emotionId: emotion.id,
//         timestamp,
//         name,
//         continent,
//       });
//     }
//   });

//   return fakeSubmissions;
// }

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
      // Map emotions to intensities for heatmap weighting
      const emotionIntensity: { [key: string]: number } = {
        happy: 0.6,
        excited: 0.8,
        angry: 1.0,
        sad: 0.4,
        tired: 0.3,
        thoughtful: 0.5,
      };

      // Create a dynamic gradient based on EMOTIONS array
      const gradient = {
        0.2: EMOTIONS.find((e) => e.id === "tired")!.color,
        0.4: EMOTIONS.find((e) => e.id === "sad")!.color,
        0.5: EMOTIONS.find((e) => e.id === "thoughtful")!.color,
        0.6: EMOTIONS.find((e) => e.id === "happy")!.color,
        0.8: EMOTIONS.find((e) => e.id === "excited")!.color,
        1.0: EMOTIONS.find((e) => e.id === "angry")!.color,
      };

      const heatPoints = data.map((submission) => {
        const intensity = emotionIntensity[submission.emotionId] || 0.5;
        return [submission.position[0], submission.position[1], intensity];
      });

      // @ts-expect-error - leaflet.heat plugin type definitions are not available
      heatLayer = L.heatLayer(heatPoints, {
        radius: 40,
        blur: 15,
        maxZoom: 17,
        minOpacity: 0.3,
        gradient,
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
      Heatmap showing density and intensity of mood submissions. Colors
      represent different emotions: yellow for happy, pink for excited, red for
      angry, blue for sad, purple for tired, and green for thoughtful.
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
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedEmotionId, setSelectedEmotionId] = useState<string>(
    EMOTIONS[0].id
  );
  const [moodText, setMoodText] = useState<string>("");
  const [nameText, setNameText] = useState<string>("");
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

  useEffect(() => {
    document.title = "Global Mood Map";
  }, []);

  // Fetch submissions from Firestore in real-time
  useEffect(() => {
    console.log("Setting up Firestore listener for 'moods' collection");
    const q = query(collection(db, "moods"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Snapshot received, docs:", snapshot.docs.length);
        console.log("Snapshot metadata:", {
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
          fromCache: snapshot.metadata.fromCache,
        });
        const fetchedSubmissions: Submission[] = [];
        const seenIds = new Set<string>();
        snapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            const continent =
              data.continent ||
              data.country ||
              getContinentFromCoordinates(data.latitude, data.longitude) ||
              "Unknown";
            fetchedSubmissions.push({
              id,
              position: [data.latitude, data.longitude],
              mood: data.mood,
              emotionId: data.emotionId,
              timestamp: data.timestamp,
              name: data.name || null,
              continent,
            });
          }
        });
        fetchedSubmissions.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setSubmissions(fetchedSubmissions);
      },
      (error) => {
        console.error("Firestore error:", error.code, error.message);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    const filtered = submissions
      .filter((submission) => {
        if (!selectedEmotions.has(submission.emotionId)) {
          return false;
        }

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
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    console.log("Filtered submissions:", filtered.length);
    return filtered;
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

  const handleSubmit = async () => {
    if (!moodText.trim())
      return alert("Please add a description of your mood.");
    if (!userLocation)
      return alert(
        "Location access required. Please allow location and try again."
      );

    try {
      const continent =
        getContinentFromCoordinates(userLocation[0], userLocation[1]) ||
        "Unknown";
      const docRef = await addDoc(collection(db, "moods"), {
        latitude: userLocation[0],
        longitude: userLocation[1],
        mood: moodText.trim(),
        emotionId: selectedEmotionId,
        timestamp: new Date().toISOString(),
        name: nameText.trim() || null,
        continent,
      });

      setMoodText("");
      setNameText("");
      setShowForm(false);
      setMapCenter(userLocation);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        "message" in error
      ) {
        console.error("Error submitting mood:", error.code, error.message);
      } else {
        console.error("Error submitting mood:", error);
      }
      alert("Failed to submit mood. Please try again.");
    }
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

  const getTimeFilterLabel = (timeFilter: TimeFilter) => {
    switch (timeFilter) {
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
      <title>Global Mood Map</title>
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
              filteredSubmissions.map((s) => (
                <Marker
                  key={s.id}
                  position={s.position}
                  icon={getIconFor(s.emotionId)}
                >
                  <Popup>
                    <div className="min-w-[200px] p-2">
                      <div className="font-semibold text-base mb-1">
                        {emotionMap.get(s.emotionId)?.label || "Unknown"} by{" "}
                        {s.name || "Anonymous"}
                      </div>
                      <div className="text-sm text-gray-800 mb-1 truncate">
                        {s.mood}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.continent || "Unknown"} •{" "}
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
              <div className="grid grid-cols-3 gap-4 mb-4">
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
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Recent Activity
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredSubmissions.slice(0, 8).map((s) => {
                    const emotion = emotionMap.get(s.emotionId);

                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded"
                      >
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-white"
                          style={{
                            backgroundColor: emotion?.color || "#999",
                          }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {emotion?.label || "Unknown"} by{" "}
                            {s.name || "Anonymous"}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {s.mood}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {s.continent || "Unknown"} •{" "}
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
                  Your Name (Optional)
                </div>
                <input
                  type="text"
                  value={nameText}
                  onChange={(ev) => setNameText(ev.target.value)}
                  maxLength={50}
                  placeholder="Enter your name or leave blank for anonymous"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {nameText.length}/50
                </div>
              </div>

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
                    setNameText("");
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
                  {filteredSubmissions.slice(0, 6).map((s) => {
                    const emotion = emotionMap.get(s.emotionId);
                    console.log("Recent submission:", {
                      id: s.id,
                      emotion: emotion?.label,
                      name: s.name,
                      mood: s.mood,
                      continent: s.continent,
                      timestamp: s.timestamp,
                    });
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => setMapCenter(s.position)}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: emotion?.color || "#999",
                          }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {emotion?.label || "Unknown"} by{" "}
                            {s.name || "Anonymous"}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {s.mood}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {s.continent || "Unknown"} •{" "}
                            {formatTimeAgo(s.timestamp)}
                          </div>
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
