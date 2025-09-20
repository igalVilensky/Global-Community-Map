// MapComponent.tsx (wrapper)
"use client";

import dynamic from "next/dynamic";

const MapInner = dynamic(() => import("./MapInner"), { ssr: false });

export default function MapComponent() {
  return <MapInner />;
}
