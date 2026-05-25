import { useMemo, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

/**
 * Zoom-reactive LOD filter for marker layers.
 *
 * Sorts data by weight descending so the highest-count ZIPs are always
 * rendered first. The visible fraction grows linearly with zoom:
 *
 *   zoom  4  →  ~14 %   (national overview)
 *   zoom  5  →  ~29 %
 *   zoom  6  →  ~43 %
 *   zoom  7  →  ~57 %
 *   zoom  8  →  ~71 %
 *   zoom  9  →  ~86 %
 *   zoom 10+ → 100 %   (local / street level)
 *
 * Always shows at least min(5, data.length) markers so the map is never
 * completely empty on low-data datasets.
 *
 * @param   {Array<{lat, lng, weight}>} data
 * @returns {{ lodData, zoom, lodFraction, total }}
 */
export function useLodData(data) {
  const map  = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({ zoomend: e => setZoom(e.target.getZoom()) });

  // Re-sort only when the underlying data array changes
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.weight - a.weight),
    [data],
  );

  const lodFraction = Math.min(1, Math.max(0.10, (zoom - 3) / 7));
  const count       = Math.max(Math.min(5, sorted.length), Math.ceil(sorted.length * lodFraction));

  return {
    lodData:     sorted.slice(0, count),
    zoom,
    lodFraction,
    total:       sorted.length,
  };
}
