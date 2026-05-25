import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

function HeatmapLayer({ data }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !data.length) return;

    const heat = L.heatLayer(
      data.map(({ lat, lng, weight }) => [lat, lng, weight]),
      {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.35: '#0000ff', 0.6: '#00ffff', 0.8: '#ffff00', 1: '#ff0000' },
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
