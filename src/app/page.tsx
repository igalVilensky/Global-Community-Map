"use client";

import MapComponent from "./components/MapComponent";
import SubmissionForm from "./components/SubmissionForm";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-6">Global Community Map</h1>
      <MapComponent />
      <SubmissionForm />
    </main>
  );
}
