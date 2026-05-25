import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// ── Custom canvas heatmap layer ───────────────────────────────────────────────
//
// Replaces leaflet.heat entirely. Each ZIP gets a radial gradient blob whose
// colour is mapped directly from its weight:
//   weight 0  →  hue 240  (blue)
//   weight 1  →  hue   0  (red)
//
// No density accumulation, no intermediate alpha pipeline — full spectrum every
// time regardless of data sparsity or how the weights were normalised.

class BlobHeatLayer extends L.Layer {
  constructor(data = []) {
    super();
    this._data = data;
  }

  setData(data) {
    this._data = data;
    if (this._canvas) this._redraw();
  }

  onAdd(map) {
    this._map = map;

    const pane  = map.getPane('overlayPane');
    const canvas = L.DomUtil.create('canvas', 'blob-heat-layer', pane);
    canvas.style.position      = 'absolute';
    canvas.style.pointerEvents = 'none';
    this._canvas = canvas;

    this._resize();
    this._redraw();

    map.on('viewreset moveend zoomend resize', this._onMapChange, this);
    return this;
  }

  onRemove(map) {
    map.off('viewreset moveend zoomend resize', this._onMapChange, this);
    this._canvas.remove();
    this._canvas = null;
    this._map    = null;
  }

  _onMapChange() {
    this._resize();
    this._redraw();
  }

  _resize() {
    const map    = this._map;
    const size   = map.getSize();
    const canvas = this._canvas;

    canvas.width  = size.x;
    canvas.height = size.y;

    // Pin canvas to the map container's top-left corner
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
  }

  _redraw() {
    const map    = this._map;
    const canvas = this._canvas;
    if (!map || !canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const { lat, lng, weight } of this._data) {
      const pt  = map.latLngToContainerPoint(L.latLng(lat, lng));
      const r   = Math.round(14 + weight * 22);   // blob radius 14–36 px
      const hue = Math.round((1 - weight) * 240); // 240 (blue) → 0 (red)

      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0,    `hsla(${hue},90%,65%,${(0.72 + weight * 0.28).toFixed(2)})`);
      g.addColorStop(0.45, `hsla(${hue},85%,55%,${(0.30 + weight * 0.20).toFixed(2)})`);
      g.addColorStop(1,    `hsla(${hue},80%,45%,0)`);

      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── React wrapper ─────────────────────────────────────────────────────────────

function HeatmapLayer({ data }) {
  const map      = useMap();
  const layerRef = useRef(null);

  // Create / destroy the canvas layer when the map instance changes
  useEffect(() => {
    const layer = new BlobHeatLayer(data);
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Push fresh data whenever weight normalisation mode changes
  useEffect(() => {
    layerRef.current?.setData(data);
  }, [data]);

  return null;
}

export default {
  id:        'heatmap',
  label:     'Heat Map',
  component: HeatmapLayer,
};
