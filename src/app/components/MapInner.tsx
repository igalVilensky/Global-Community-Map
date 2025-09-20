import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

import {
  MapPin,
  Users,
  Heart,
  Zap,
  Globe,
  Send,
  Map,
  TrendingUp,
} from "lucide-react";

const markerIcon2x = "/node_modules/leaflet/dist/images/marker-icon-2x.png";
const markerIcon = "/node_modules/leaflet/dist/images/marker-icon.png";
const markerShadow = "/node_modules/leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const EMOTIONS = [
  { emoji: "😊", label: "Happy", color: "from-yellow-400 to-orange-400" },
  { emoji: "😢", label: "Sad", color: "from-blue-400 to-blue-600" },
  { emoji: "😡", label: "Angry", color: "from-red-400 to-red-600" },
  { emoji: "😴", label: "Tired", color: "from-purple-400 to-purple-600" },
  { emoji: "🤔", label: "Thoughtful", color: "from-green-400 to-green-600" },
  { emoji: "🎉", label: "Excited", color: "from-pink-400 to-pink-600" },
];

// Custom mood marker icon
const createMoodIcon = (emoji) => {
  return L.divIcon({
    className: "custom-mood-marker",
    html: `<div class="bg-white rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg border-2 border-blue-500">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

export default function GlobalCommunityMap() {
  const [selectedEmotion, setSelectedEmotion] = useState(EMOTIONS[0]);
  const [moodText, setMoodText] = useState("");
  const [submissions, setSubmissions] = useState([
    {
      position: [40.7128, -74.006],
      mood: "Loving the energy!",
      emotion: "😊",
      timestamp: new Date(),
    },
    {
      position: [51.5074, -0.1278],
      mood: "Rainy day blues",
      emotion: "😢",
      timestamp: new Date(),
    },
    {
      position: [35.6762, 139.6503],
      mood: "Work is crazy",
      emotion: "😴",
      timestamp: new Date(),
    },
  ]);
  const [userLocation, setUserLocation] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mapCenter, setMapCenter] = useState([20, 0]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(location);
        setMapCenter(location);
      },
      (err) => console.error(err)
    );
  }, []);

  const handleSubmit = () => {
    if (!moodText.trim()) return;
    if (!userLocation) {
      alert("Location not detected yet!");
      return;
    }

    const newSubmission = {
      position: userLocation,
      mood: moodText,
      emotion: selectedEmotion.emoji,
      timestamp: new Date(),
    };

    setSubmissions((prev) => [...prev, newSubmission]);
    setMoodText("");
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const stats = {
    totalSubmissions: submissions.length,
    activeUsers: Math.floor(submissions.length * 0.7),
    topEmotion: EMOTIONS[0].label,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative container mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Global Community Map
            </h1>
          </div>
          <p className="text-center text-slate-300 text-lg max-w-2xl mx-auto">
            Share your mood with the world and connect with the global
            community&apos;s emotions in real-time
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 pb-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 backdrop-blur-sm border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-blue-400">
                  {stats.totalSubmissions}
                </h3>
                <p className="text-slate-400">Total Moods</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 backdrop-blur-sm border border-green-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-400">
                  {stats.activeUsers}
                </h3>
                <p className="text-slate-400">Active Users</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-purple-400">
                  😊 {stats.topEmotion}
                </h3>
                <p className="text-slate-400">Trending Mood</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mood Input Form */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 sticky top-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Heart className="w-6 h-6 text-pink-400" />
                Share Your Mood
              </h2>

              <div className="space-y-6">
                {/* Emotion Selector */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-slate-300">
                    How are you feeling?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {EMOTIONS.map((emotion) => (
                      <button
                        key={emotion.label}
                        onClick={() => setSelectedEmotion(emotion)}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                          selectedEmotion.label === emotion.label
                            ? `bg-gradient-to-r ${emotion.color} border-white/30 shadow-lg scale-105`
                            : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
                        }`}
                      >
                        <div className="text-2xl mb-1">{emotion.emoji}</div>
                        <div className="text-xs font-medium">
                          {emotion.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood Input */}
                <div>
                  <label className="block text-sm font-semibold mb-3 text-slate-300">
                    What&apos;s on your mind?
                  </label>
                  <textarea
                    value={moodText}
                    onChange={(e) => setMoodText(e.target.value)}
                    placeholder="Share your thoughts, feelings, or what's happening..."
                    className="w-full p-4 bg-slate-800/50 border border-slate-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200 resize-none text-white placeholder-slate-400"
                    rows={3}
                    maxLength={280}
                  />
                  <div className="text-right text-xs text-slate-400 mt-1">
                    {moodText.length}/280
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!moodText.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <Send className="w-5 h-5" />
                  Share with World
                </button>
              </div>

              {/* Success Message */}
              {showSuccess && (
                <div className="mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-center animate-pulse">
                  ✨ Your mood has been shared with the world!
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Map className="w-6 h-6 text-blue-400" />
                Global Mood Map
              </h2>

              <div className="w-full h-[500px] rounded-2xl overflow-hidden">
                <MapContainer
                  center={mapCenter}
                  zoom={userLocation ? 10 : 2}
                  style={{ height: "100%", width: "100%" }}
                  className="rounded-2xl"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {/* Current user location */}
                  {userLocation && (
                    <Marker position={userLocation}>
                      <Popup>
                        <div className="text-center">
                          <strong>📍 Your location</strong>
                          <br />
                          Ready to share your mood!
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Mood submissions */}
                  {submissions.map((submission, index) => (
                    <Marker
                      key={index}
                      position={submission.position}
                      icon={createMoodIcon(submission.emotion)}
                    >
                      <Popup>
                        <div className="text-center max-w-xs">
                          <div className="text-2xl mb-2">
                            {submission.emotion}
                          </div>
                          <div className="font-semibold text-gray-800">
                            {submission.mood}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            {submission.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="mt-4 text-sm text-slate-400 text-center">
                🌍 {submissions.length} moods shared • Your location:{" "}
                {userLocation ? "✅ Found" : "📍 Detecting..."}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Moods */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-400" />
            Recent Moods from Around the World
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {submissions
              .slice(-6)
              .reverse()
              .map((submission, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-sm border border-slate-700/30 rounded-xl p-4 hover:scale-105 transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{submission.emotion}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium break-words">
                        {submission.mood}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" />
                        <span>
                          Anonymous •{" "}
                          {submission.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
