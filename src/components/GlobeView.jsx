import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { heatGradients, defaultGradient } from '../mapStyles/heatGradients.js';

const EARTH_TEX = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const SKY_TEX   = '//unpkg.com/three-globe/example/img/night-sky.png';

// Replace the alpha in an hsla() string — used to set arc fade colours
function withAlpha(hslaStr, alpha) {
  return hslaStr.replace(/,[\d.]+\)$/, `,${alpha})`);
}

export default function GlobeView({ data, origin, showSpikes = true, showArcs = true, arcsAnimated = true, gradientId = 'spectrum' }) {
  const globeRef     = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const gradient = heatGradients.find(g => g.id === gradientId) ?? defaultGradient;

  // Track container size so the canvas fills the flex area
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // On globe ready — fly to USA, start slow auto-rotate
  function handleGlobeReady() {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 38, lng: -96, altitude: 2.1 }, 900);
    const ctrl = g.controls();
    ctrl.autoRotate        = true;
    ctrl.autoRotateSpeed   = 0.35;
    ctrl.enableDamping     = true;
    ctrl.dampingFactor     = 0.25;  // more friction → stops quickly, easier to aim
    ctrl.rotateSpeed       = 0.6;   // slower rotation → precise angle control
    ctrl.enablePan         = true;
    ctrl.panSpeed          = 1.2;
    ctrl.screenSpacePanning = true; // pan in screen space (feels like a map)

    // Three-globe overrides OrbitControls.mouseButtons internally — re-assign
    // explicitly so left = rotate and right = pan.  THREE.MOUSE.ROTATE = 0,
    // THREE.MOUSE.PAN = 2.  Using numeric literals avoids a THREE import.
    ctrl.mouseButtons = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };

    // Touch: one-finger rotate, two-finger pan
    ctrl.touches = { ONE: 0, TWO: 2 };
  }

  // Stop auto-rotate the moment the user grabs the globe
  function handlePointerDown() {
    const ctrl = globeRef.current?.controls();
    if (ctrl) ctrl.autoRotate = false;
  }

  const rings = origin ? [{ lat: origin.lat, lng: origin.lng }] : [];

  // Arcs: origin → each customer ZIP (hidden when showArcs is off or no origin)
  const arcs = (showArcs && origin)
    ? data
        .filter(d =>
          Math.abs(d.lat - origin.lat) > 0.05 ||
          Math.abs(d.lng - origin.lng) > 0.05
        )
        .map(d => {
          const baseColor = gradient.center(d.weight);
          return {
            startLat: origin.lat,
            startLng: origin.lng,
            endLat:   d.lat,
            endLng:   d.lng,
            weight:   d.weight,
            color:    [withAlpha(baseColor, 0.12), withAlpha(baseColor, 0.88)],
          };
        })
    : [];

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950"
      onPointerDown={handlePointerDown}
      onContextMenu={e => e.preventDefault()}
    >
      {dims.w > 0 && dims.h > 0 && (
        <Globe
          ref={globeRef}
          width={dims.w}
          height={dims.h}
          onGlobeReady={handleGlobeReady}

          // ── Globe surface ───────────────────────────────────────────────
          globeImageUrl={EARTH_TEX}
          backgroundImageUrl={SKY_TEX}
          atmosphereColor="rgba(63,120,255,0.28)"
          atmosphereAltitude={0.14}

          // ── Data points — coloured spikes per ZIP ───────────────────────
          pointsData={showSpikes ? data : []}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={d => 0.005 + d.weight * 0.09}
          pointRadius={d => 0.18 + d.weight * 0.52}
          pointColor={d => gradient.center(d.weight)}
          pointsMerge={false}
          pointResolution={6}

          // ── Origin ring — pulsing gold halo at shop ZIP ─────────────────
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringMaxRadius={4.5}
          ringPropagationSpeed={2.5}
          ringRepeatPeriod={900}
          ringColor={() => 'rgba(255,210,70,0.75)'}
          ringAltitude={0.003}

          // ── Shipping arcs — origin → each customer ZIP ───────────────────
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcAltitudeAutoScale={0.35}
          arcStroke={d => 0.2 + d.weight * 0.7}
          arcDashLength={arcsAnimated ? 0.45 : 1}
          arcDashGap={arcsAnimated ? 0.2 : 0}
          arcDashAnimateTime={arcsAnimated ? 2200 : 0}
        />
      )}
    </div>
  );
}
