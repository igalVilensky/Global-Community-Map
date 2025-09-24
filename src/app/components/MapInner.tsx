"use client";

import React, { Fragment, useEffect, useMemo, useState } from "react";
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
  ChevronDown,
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
  Plus,
} from "lucide-react";
import { Listbox, Transition } from "@headlessui/react";

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

type Layer = {
  id: string;
  name: string;
  description: string;
  type: "free-text" | "poll";
  options?: string[]; // For poll layers
  creator: string | null; // Anonymous for now
  createdAt: string;
};

type Submission = {
  id: string;
  layerId: string;
  position: [number, number];
  mood: string; // Free text or poll answer
  emotionId?: string; // Optional for non-mood layers
  timestamp: string;
  name?: string | null;
  continent?: string | null;
};

type TimeFilter = "all" | "24h" | "week" | "month";

/* ----------------------------
   HELPER: simplified continent lookup
   ---------------------------- */
function getContinentFromCoordinates(lat: number, lng: number): string | null {
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
  currentLayer,
}: {
  data: Submission[];
  showHeatmap: boolean;
  currentLayer: Layer | null;
}) {
  const map = useMap();

  useEffect(() => {
    let heatLayer = null;

    if (showHeatmap && data.length > 0) {
      // Map emotions or poll options to intensities
      const intensityMap: { [key: string]: number } =
        currentLayer?.type === "poll"
          ? Object.fromEntries(
              (currentLayer.options || []).map((opt, i) => [
                opt,
                0.2 + (i * 0.8) / ((currentLayer.options?.length ?? 2) - 1),
              ])
            )
          : {
              happy: 0.6,
              excited: 0.8,
              angry: 1.0,
              sad: 0.4,
              tired: 0.3,
              thoughtful: 0.5,
            };

      // Create a dynamic gradient
      const gradient =
        currentLayer?.type === "poll"
          ? {
              0.2: "#FFEDA0",
              0.4: "#FEB24C",
              0.6: "#FD8D3C",
              0.8: "#F03B20",
              1.0: "#BD0026",
            }
          : {
              0.2: EMOTIONS.find((e) => e.id === "tired")!.color,
              0.4: EMOTIONS.find((e) => e.id === "sad")!.color,
              0.5: EMOTIONS.find((e) => e.id === "thoughtful")!.color,
              0.6: EMOTIONS.find((e) => e.id === "happy")!.color,
              0.8: EMOTIONS.find((e) => e.id === "excited")!.color,
              1.0: EMOTIONS.find((e) => e.id === "angry")!.color,
            };

      const heatPoints = data.map((submission) => {
        const intensity =
          intensityMap[submission.emotionId || submission.mood] || 0.5;
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
  }, [map, data, showHeatmap, currentLayer]);

  return showHeatmap ? (
    <div className="sr-only">
      Heatmap showing density and intensity of submissions. Colors represent
      different {currentLayer?.type === "poll" ? "answers" : "emotions"}.
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
  const [layers, setLayers] = useState<Layer[]>([
    {
      id: "global-moods",
      name: "Global Moods",
      description: "Share how you're feeling today",
      type: "free-text",
      creator: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "daily-thoughts",
      name: "Daily Thoughts",
      description: "Share a thought or idea",
      type: "free-text",
      creator: null,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [currentLayerId, setCurrentLayerId] = useState<string>("global-moods");
  const [selectedEmotionId, setSelectedEmotionId] = useState<string | null>(
    EMOTIONS[0].id
  );
  const [moodText, setMoodText] = useState<string>("");
  const [nameText, setNameText] = useState<string>("");
  const [showStats, setShowStats] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateLayer, setShowCreateLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState("");
  const [newLayerDescription, setNewLayerDescription] = useState("");
  const [newLayerType, setNewLayerType] = useState<"free-text" | "poll">(
    "free-text"
  );
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Filter states
  const [selectedEmotions, setSelectedEmotions] = useState<Set<string>>(
    new Set(EMOTIONS.map((e) => e.id))
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const emotionMap = useMemo(() => {
    const m = new Map<string, Emotion>();
    EMOTIONS.forEach((e) => m.set(e.id, e));
    return m;
  }, []);

  const currentLayer = useMemo(() => {
    return layers.find((l) => l.id === currentLayerId) || null;
  }, [layers, currentLayerId]);

  useEffect(() => {
    document.title = `Global Mood Map - ${currentLayer?.name || "Map"}`;
  }, [currentLayer]);

  // Fetch layers from Firestore
  useEffect(() => {
    const q = query(collection(db, "layers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLayers: Layer[] = [
          {
            id: "global-moods",
            name: "Global Moods",
            description: "Share how you're feeling today",
            type: "free-text",
            creator: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: "daily-thoughts",
            name: "Daily Thoughts",
            description: "Share a thought or idea",
            type: "free-text",
            creator: null,
            createdAt: new Date().toISOString(),
          },
        ];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedLayers.push({
            id: doc.id,
            name: data.name,
            description: data.description,
            type: data.type,
            options: data.options || [],
            creator: data.creator || null,
            createdAt: data.createdAt,
          });
        });
        setLayers(fetchedLayers);
      },
      (error) => {
        console.error("Firestore error (layers):", error.code, error.message);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch submissions from Firestore in real-time
  useEffect(() => {
    console.log("Setting up Firestore listener for 'submissions' collection");
    const q = query(
      collection(db, "submissions"),
      orderBy("timestamp", "desc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Snapshot received, docs:", snapshot.docs.length);
        const fetchedSubmissions: Submission[] = [];
        const seenIds = new Set<string>();
        snapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            const continent =
              data.continent ||
              getContinentFromCoordinates(data.latitude, data.longitude) ||
              "Unknown";
            fetchedSubmissions.push({
              id,
              layerId: data.layerId || "global-moods",
              position: [data.latitude, data.longitude],
              mood: data.mood,
              emotionId: data.emotionId || undefined,
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
        if (submission.layerId !== currentLayerId) return false;

        if (currentLayer?.type === "free-text" && submission.emotionId) {
          if (!selectedEmotions.has(submission.emotionId)) return false;
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
  }, [submissions, currentLayerId, selectedEmotions, timeFilter, currentLayer]);

  const stats = useMemo(() => {
    const total = filteredSubmissions.length;
    const active = Math.max(1, Math.floor(total * 0.7));
    let top = "—";
    if (total > 0) {
      const counts = new Map<string, number>();
      for (const s of filteredSubmissions) {
        const key =
          currentLayer?.type === "poll" ? s.mood : s.emotionId || s.mood;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      let max = 0;
      counts.forEach((n, id) => {
        if (n > max) {
          max = n;
          top =
            currentLayer?.type === "poll"
              ? id
              : emotionMap.get(id)?.label ?? id;
        }
      });
    }
    return { total, active, top };
  }, [filteredSubmissions, emotionMap, currentLayer]);

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
    // Validate input: require moodText for free-text layers, ensure valid option for poll layers
    if (!moodText.trim()) {
      return alert("Please select an option or enter a description.");
    }
    if (
      currentLayer?.type === "poll" &&
      !currentLayer.options?.includes(moodText)
    ) {
      return alert("Please select a valid poll option.");
    }
    if (!userLocation) {
      return alert(
        "Location access required. Please allow location and try again."
      );
    }

    try {
      const continent =
        getContinentFromCoordinates(userLocation[0], userLocation[1]) ||
        "Unknown";
      const submissionData: {
        layerId: string;
        latitude: number;
        longitude: number;
        mood: string;
        timestamp: string;
        name: string | null;
        continent: string;
        emotionId?: string;
      } = {
        layerId: currentLayerId,
        latitude: userLocation[0],
        longitude: userLocation[1],
        mood: moodText.trim(),
        timestamp: new Date().toISOString(),
        name: nameText.trim() || null,
        continent,
      };

      // Only include emotionId for free-text layers
      if (currentLayer?.type === "free-text" && selectedEmotionId) {
        submissionData.emotionId = selectedEmotionId;
      }

      // const docRef = await addDoc(
      //   collection(db, "submissions"),
      //   submissionData
      // );

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
      alert("Failed to submit. Please try again.");
    }
  };

  const handleCreateLayer = async () => {
    if (!newLayerName.trim()) return alert("Layer name is required.");
    if (!newLayerDescription.trim())
      return alert("Layer description is required.");
    if (newLayerType === "poll" && pollOptions.some((opt) => !opt.trim()))
      return alert("All poll options must be filled.");

    try {
      const docRef = await addDoc(collection(db, "layers"), {
        name: newLayerName.trim(),
        description: newLayerDescription.trim(),
        type: newLayerType,
        options:
          newLayerType === "poll"
            ? pollOptions.filter((opt) => opt.trim())
            : [],
        creator: null,
        createdAt: new Date().toISOString(),
      });
      setNewLayerName("");
      setNewLayerDescription("");
      setNewLayerType("free-text");
      setPollOptions(["", ""]);
      setShowCreateLayer(false);
      setCurrentLayerId(docRef.id);
    } catch (error) {
      console.error("Error creating layer:", error);
      alert("Failed to create layer. Please try again.");
    }
  };

  const getIconFor = (submission: Submission) => {
    if (currentLayer?.type === "poll") {
      const index = currentLayer.options?.indexOf(submission.mood) || 0;
      const color = ["#FFEDA0", "#FEB24C", "#FD8D3C", "#F03B20", "#BD0026"][
        index % 5
      ];
      return createSvgIcon(submission.mood[0]?.toUpperCase() || "•", color, 38);
    }
    const em = emotionMap.get(submission.emotionId || "");
    const label = em
      ? em.label[0].toUpperCase()
      : submission.mood[0]?.toUpperCase() || "•";
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
      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
            G
          </div>
          <Listbox
            value={currentLayerId}
            onChange={(value) => {
              setCurrentLayerId(value);
              setSelectedEmotionId(EMOTIONS[0].id);
              setSelectedEmotions(new Set(EMOTIONS.map((e) => e.id)));
              setTimeFilter("all");
            }}
          >
            <Listbox.Button className="flex items-center gap-2 text-lg font-semibold max-w-[140px] sm:max-w-[200px] truncate">
              <span className="truncate">
                {layers.find((l) => l.id === currentLayerId)?.name ||
                  "Select Layer"}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </Listbox.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Listbox.Options className="absolute left-0 top-12 max-h-60 w-64 bg-white border border-gray-200 rounded-md shadow-lg overflow-y-auto">
                {layers.map((layer) => (
                  <Listbox.Option
                    key={layer.id}
                    value={layer.id}
                    className="p-2 hover:bg-gray-100 truncate cursor-pointer"
                  >
                    {layer.name.length > 20
                      ? `${layer.name.slice(0, 17)}...`
                      : layer.name}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </Listbox>
          <div className="hidden sm:block px-2 py-1 bg-gray-100 rounded text-xs font-medium">
            {filteredSubmissions.length} submissions
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateLayer(!showCreateLayer)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors ${
              showCreateLayer
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Layer</span>
          </button>
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
            <span className="hidden sm:inline">Share</span>
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
              currentLayer={currentLayer}
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
                      You can submit to {currentLayer?.name || "this layer"}{" "}
                      from here
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {!showHeatmap &&
              filteredSubmissions.map((s) => (
                <Marker key={s.id} position={s.position} icon={getIconFor(s)}>
                  <Popup>
                    <div className="min-w-[200px] p-2">
                      <div className="font-semibold text-base mb-1">
                        {currentLayer?.type === "poll"
                          ? s.mood
                          : emotionMap.get(s.emotionId || "")?.label ||
                            s.mood}{" "}
                        by {s.name || "Anonymous"}
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

        {/* Create Layer Panel */}
        {showCreateLayer && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40 w-[95%] max-w-lg bg-white border border-gray-200 rounded-lg shadow-xl">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-500" />
                  <div className="font-semibold">Create New Layer</div>
                </div>
                <button
                  onClick={() => setShowCreateLayer(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Layer Name
                </div>
                <input
                  type="text"
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  maxLength={50}
                  placeholder="e.g., Favorite Local Food"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {newLayerName.length}/50
                </div>
              </div>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Description
                </div>
                <textarea
                  value={newLayerDescription}
                  onChange={(e) => setNewLayerDescription(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Describe what this layer is about..."
                  className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {newLayerDescription.length}/280
                </div>
              </div>
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Layer Type
                </div>
                <select
                  value={newLayerType}
                  onChange={(e) =>
                    setNewLayerType(e.target.value as "free-text" | "poll")
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="free-text">Free Text</option>
                  <option value="poll">Poll (Multiple Choice)</option>
                </select>
              </div>
              {newLayerType === "poll" && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Poll Options (2-4)
                  </div>
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...pollOptions];
                          newOptions[index] = e.target.value;
                          setPollOptions(newOptions);
                        }}
                        maxLength={50}
                        placeholder={`Option ${index + 1}`}
                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {index >= 2 && (
                        <button
                          onClick={() =>
                            setPollOptions(
                              pollOptions.filter((_, i) => i !== index)
                            )
                          }
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setNewLayerName("");
                    setNewLayerDescription("");
                    setNewLayerType("free-text");
                    setPollOptions(["", ""]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={handleCreateLayer}
                  disabled={!newLayerName.trim() || !newLayerDescription.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Create Layer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Panel */}
        {showStats && (
          <div className="absolute top-4 right-4 z-40 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <div className="font-semibold">Layer Stats</div>
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
                  <div className="text-sm text-gray-600">Total Submissions</div>
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
                  <div className="text-sm text-gray-600">
                    Top {currentLayer?.type === "poll" ? "Answer" : "Emotion"}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Recent Activity
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredSubmissions.slice(0, 8).map((s) => {
                    const emotion = emotionMap.get(s.emotionId || "");
                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-2 p-2 bg-gray-50 rounded"
                      >
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-white"
                          style={{
                            backgroundColor:
                              currentLayer?.type === "poll"
                                ? [
                                    "#FFEDA0",
                                    "#FEB24C",
                                    "#FD8D3C",
                                    "#F03B20",
                                    "#BD0026",
                                  ][
                                    (currentLayer.options?.indexOf(s.mood) ||
                                      0) % 5
                                  ]
                                : emotion?.color || "#999",
                          }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {currentLayer?.type === "poll"
                              ? s.mood
                              : emotion?.label || s.mood}{" "}
                            by {s.name || "Anonymous"}
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
                  <div className="font-semibold">
                    Share to {currentLayer?.name}
                  </div>
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
              {currentLayer?.type === "free-text" && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    {currentLayer.id === "global-moods"
                      ? "How are you feeling?"
                      : "Emotion (Optional)"}
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
              )}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  {currentLayer?.type === "poll"
                    ? "Choose an Option"
                    : currentLayer?.description || "What's on your mind?"}
                </div>
                {currentLayer?.type === "poll" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {currentLayer.options?.map((option) => (
                      <button
                        key={option}
                        onClick={() => setMoodText(option)}
                        className={`flex items-center gap-2 p-2 rounded-md border text-sm font-medium transition-colors ${
                          moodText === option
                            ? "bg-blue-50 border-blue-300 text-blue-800"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={moodText}
                    onChange={(ev) => setMoodText(ev.target.value)}
                    rows={3}
                    maxLength={280}
                    placeholder={
                      currentLayer?.description ||
                      "Share what's on your mind..."
                    }
                    className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
                {currentLayer?.type !== "poll" && (
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {moodText.length}/280
                  </div>
                )}
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
                  disabled={currentLayer?.type !== "poll" && !moodText.trim()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Submissions Toggle */}
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
                <div className="font-semibold text-sm">
                  Recent in {currentLayer?.name}
                </div>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {filteredSubmissions.slice(0, 6).map((s) => {
                    const emotion = emotionMap.get(s.emotionId || "");
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => setMapCenter(s.position)}
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              currentLayer?.type === "poll"
                                ? [
                                    "#FFEDA0",
                                    "#FEB24C",
                                    "#FD8D3C",
                                    "#F03B20",
                                    "#BD0026",
                                  ][
                                    (currentLayer.options?.indexOf(s.mood) ||
                                      0) % 5
                                  ]
                                : emotion?.color || "#999",
                          }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {currentLayer?.type === "poll"
                              ? s.mood
                              : emotion?.label || s.mood}{" "}
                            by {s.name || "Anonymous"}
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
                        Density visualization based on{" "}
                        {currentLayer?.type === "poll" ? "answers" : "emotions"}
                      </div>
                    )}
                  </div>
                </div>
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
                {currentLayer?.type === "free-text" && (
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
                )}
                {(selectedEmotions.size < EMOTIONS.length ||
                  timeFilter !== "all") && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600 mb-2">
                      Showing {filteredSubmissions.length} of{" "}
                      {submissions.length} submissions
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {timeFilter !== "all" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                          <Clock className="w-3 h-3" />
                          {getTimeFilterLabel(timeFilter)}
                        </span>
                      )}
                      {currentLayer?.type === "free-text" &&
                        selectedEmotions.size < EMOTIONS.length && (
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
