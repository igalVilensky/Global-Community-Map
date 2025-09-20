"use client";

import MapComponent from "./components/MapComponent";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <MapComponent />
    </main>
  );
}
