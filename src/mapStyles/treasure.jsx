import { Marker } from 'react-leaflet';
import L from 'leaflet';

const MIN_SIZE   = 14;
const MAX_SIZE   = 38;
const MIN_LAYERS = 1;
const MAX_LAYERS = 6;

function makeTreasureIcon(weight) {
  const size    = Math.round(MIN_SIZE + weight * (MAX_SIZE - MIN_SIZE));
  const layers  = Math.round(MIN_LAYERS + weight * (MAX_LAYERS - MIN_LAYERS));
  const step    = Math.round(size * 0.42);
  const hasBag  = weight >= 0.66;
  const bagSize = Math.round(size * 0.85);

  const coinsH = size + step * (layers - 1);
  const totalH = hasBag ? coinsH + Math.round(bagSize * 0.65) : coinsH;
  const w      = size + 12;

  const coins = Array.from({ length: layers }, (_, i) =>
    `<span style="position:absolute;bottom:${i * step}px;left:50%;transform:translateX(-50%);font-size:${size}px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7));">🪙</span>`
  ).join('');

  const bag = hasBag
    ? `<span style="position:absolute;bottom:${coinsH - Math.round(bagSize * 0.35)}px;left:50%;transform:translateX(-50%);font-size:${bagSize}px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.7));">💰</span>`
    : '';

  return L.divIcon({
    html:       `<div style="position:relative;width:${w}px;height:${totalH}px;">${coins}${bag}</div>`,
    className:  '',
    iconSize:   [w, totalH],
    iconAnchor: [w / 2, totalH],
  });
}

function TreasureLayer({ data }) {
  return data.map(({ lat, lng, weight }, i) => (
    <Marker
      key={`treasure-${lat}-${lng}-${i}`}
      position={[lat, lng]}
      icon={makeTreasureIcon(weight)}
    />
  ));
}

export default {
  id:        'treasure',
  label:     'Treasure',
  component: TreasureLayer,
};
