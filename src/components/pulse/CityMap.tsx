import { lazy, Suspense, useEffect, useState } from "react";
import { MapSkeleton } from "./Skeletons";

// react-leaflet + leaflet touch `window` at module scope, so we must never
// import them during SSR. Lazy-loading defers the import until after mount
// on the client, where `window` exists.
const CityMapInner = lazy(() => import("./CityMapLeaflet"));

export function CityMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <MapSkeleton />;

  return (
    <Suspense fallback={<MapSkeleton />}>
      <CityMapInner />
    </Suspense>
  );
}
