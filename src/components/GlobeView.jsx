import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';

const EARTH_TEX = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const SKY_TEX   = '//unpkg.com/three-globe/example/img/night-sky.png';

export default function GlobeView({ data, origin }) {
  const globeRef     = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Track container size so the canvas fills the flex area
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    // Seed with current size immediately
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // On globe ready — fly to USA, start slow auto-rotate
  function handleGlobeReady() {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 38, lng: -96, altitude: 2.1 }, 900);
    const ctrl = g.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.35;
    ctrl.enableDamping   = true;
    ctrl.dampingFactor   = 0.1;
  }

  // Stop auto-rotate the moment the user grabs the globe
  function handlePointerDown() {
    const ctrl = globeRef.current?.controls();
    if (ctrl) ctrl.autoRotate = false;
  }

  const rings = origin ? [{ lat: origin.lat, lng: origin.lng }] : [];

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950"
      onPointerDown={handlePointerDown}
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

          // ── Data points — colored spikes per ZIP ────────────────────────
          pointsData={data}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={d => 0.005 + d.weight * 0.09}
          pointRadius={d => 0.18 + d.weight * 0.52}
          pointColor={d => {
            const hue = Math.round((1 - d.weight) * 240);
            return `hsla(${hue}, 90%, 65%, 0.92)`;
          }}
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
        />
      )}
    </div>
  );
}
