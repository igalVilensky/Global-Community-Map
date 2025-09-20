"use client";

import { useState } from "react";

export default function SubmissionForm() {
  const [mood, setMood] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Mood submitted: ${mood}`);
    setMood("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-2 w-full max-w-md"
    >
      <input
        type="text"
        value={mood}
        onChange={(e) => setMood(e.target.value)}
        placeholder="Enter your mood or stat"
        className="w-full p-2 rounded-lg text-black"
      />
      <button
        type="submit"
        className="bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Submit
      </button>
    </form>
  );
}
