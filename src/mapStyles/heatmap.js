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
        minOpacity: 0.4,
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
