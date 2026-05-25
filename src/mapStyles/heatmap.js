import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

function HeatmapLayer({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !data.length) return;

    // Remap weights from [0, 1] → [FLOOR, 1] so every point renders
    // visibly AND differences between scale modes are preserved.
    // minOpacity was removed because it floors all low-weight points to
    // the same globalAlpha, making Linear / Log / Rank look identical.
    const FLOOR = 0.3;
    const heat = L.heatLayer(
      data.map(({ lat, lng, weight }) => [lat, lng, FLOOR + weight * (1 - FLOOR)]),
      {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0: '#0000ff', 0.3: '#00ffff', 0.65: '#ffff00', 1: '#ff0000' },
      }
    ).addTo(map);

    return () => heat.remove();
  }, [map, data]);

  return null;
}

export default {
  id: 'heatmap',
  label: 'Heatmap',
  component: HeatmapLayer,
};
