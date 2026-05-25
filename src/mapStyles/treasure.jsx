import { Marker } from 'react-leaflet';
import L from 'leaflet';

const MIN_SIZE   = 9;
const MAX_SIZE   = 22;
const MIN_LAYERS = 1;
const MAX_LAYERS = 5;

// Deterministic jitter — same result every render for a given lat/lng
function stableJitter(lat, lng) {
  const u = Math.sin(lat * 92.3  + lng * 187.6) * 43758.5453;
  const v = Math.sin(lat * 47.9  + lng * 283.1) * 43758.5453;
  return {
    dLat: (u - Math.floor(u) - 0.5) * 0.30,  // ±0.15°
    dLng: (v - Math.floor(v) - 0.5) * 0.40,  // ±0.20°
  };
}

function makeTreasureIcon(weight) {
  const size    = Math.round(MIN_SIZE + weight * (MAX_SIZE - MIN_SIZE));
  const layers  = Math.round(MIN_LAYERS + weight * (MAX_LAYERS - MIN_LAYERS));
  const step    = Math.round(size * 0.42);
  const hasBag  = weight >= 0.66;
  const bagSize = Math.round(size * 0.85);

  const coinsH = size + step * (layers - 1);
  const totalH = hasBag ? coinsH + Math.round(bagSize * 0.65) : coinsH;
  const w      = size + 10;

  const coins = Array.from({ length: layers }, (_, i) => {
    // deterministic per-coin horizontal wobble
    const r = Math.sin((i + 1) * 73.1) * 43758.5453;
    const nudge = Math.round((r - Math.floor(r) - 0.5) * size * 0.9);
    return `<span style="position:absolute;bottom:${i * step}px;left:calc(50% + ${nudge}px);transform:translateX(-50%);font-size:${size}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">🪙</span>`;
  }).join('');

  const bag = hasBag
    ? `<span style="position:absolute;bottom:${coinsH - Math.round(bagSize * 0.35)}px;left:50%;transform:translateX(-50%);font-size:${bagSize}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.8));">💰</span>`
    : '';

  return L.divIcon({
    html:       `<div style="position:relative;width:${w}px;height:${totalH}px;">${coins}${bag}</div>`,
    className:  '',
    iconSize:   [w, totalH],
    iconAnchor: [w / 2, totalH],
  });
}

function TreasureLayer({ data }) {
  return data.map(({ lat, lng, weight }, i) => {
    const { dLat, dLng } = stableJitter(lat, lng);
    return (
      <Marker
        key={`treasure-${lat}-${lng}-${i}`}
        position={[lat + dLat, lng + dLng]}
        icon={makeTreasureIcon(weight)}
      />
    );
  });
}

export default {
  id:        'treasure',
  label:     'Treasure',
  component: TreasureLayer,
};
