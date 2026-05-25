import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { Vector3 } from 'three';
import { heatGradients, defaultGradient } from '../mapStyles/heatGradients.js';

const EARTH_TEX = '//unpkg.com/three-globe/example/img/earth-night.jpg';
const SKY_TEX   = '//unpkg.com/three-globe/example/img/night-sky.png';

// Replace the alpha in an hsla() string — used to set arc fade colours
function withAlpha(hslaStr, alpha) {
  return hslaStr.replace(/,[\d.]+\)$/, `,${alpha})`);
}

// Three.js MOUSE action constants:  ROTATE=0, DOLLY=1, PAN=2
const M_ROTATE = 0;
const M_DOLLY  = 1;
const M_PAN    = 2;

export default function GlobeView({ data, origin, showSpikes = true, showArcs = true, arcsAnimated = true, gradientId = 'spectrum' }) {
  const globeRef     = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [isReady, setIsReady] = useState(false);

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

  // On globe ready — fly to USA and signal the controls-config effect below
  function handleGlobeReady() {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 38, lng: -96, altitude: 2.1 }, 900);
    setIsReady(true);
  }

  // Controls configuration — re-applied at several intervals after ready
  // because three-globe sometimes resets mouseButtons after onGlobeReady
  // fires.  Properties on existing objects are MUTATED, not replaced.
  useEffect(() => {
    if (!isReady) return;

    const apply = () => {
      const ctrl = globeRef.current?.controls();
      if (!ctrl) return;

      ctrl.autoRotateSpeed    = 0.35;
      ctrl.enableDamping      = true;
      ctrl.dampingFactor      = 0.25;
      ctrl.rotateSpeed        = 0.6;
      ctrl.enablePan          = true;
      ctrl.panSpeed           = 1.2;
      ctrl.screenSpacePanning = true;

      if (ctrl.mouseButtons) {
        ctrl.mouseButtons.LEFT   = M_ROTATE;
        ctrl.mouseButtons.MIDDLE = M_DOLLY;
        ctrl.mouseButtons.RIGHT  = M_PAN;
      }
      if (ctrl.touches) {
        ctrl.touches.ONE = M_ROTATE;
        ctrl.touches.TWO = M_PAN;
      }
    };

    // Initial auto-rotate (one-time)
    const ctrl0 = globeRef.current?.controls();
    if (ctrl0) ctrl0.autoRotate = true;

    apply();
    const t1 = setTimeout(apply, 50);
    const t2 = setTimeout(apply, 250);
    const t3 = setTimeout(apply, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isReady]);

  // Custom right-click pan: shifts the orbit target (pivot point).
  // Bypasses OrbitControls' mouseButtons assignment because three-globe
  // intercepts those events.  Pan math mirrors OrbitControls' internal
  // pan: convert pixel delta → world delta along camera's local X/Y axes.
  useEffect(() => {
    if (!isReady) return;
    const el = containerRef.current;
    if (!el) return;

    const panOffset = new Vector3();
    const tmpV      = new Vector3();
    let panning = false;
    let lastX   = 0;
    let lastY   = 0;

    function onMouseDown(e) {
      if (e.button !== 2) return;          // right button only
      const ctrl = globeRef.current?.controls();
      if (!ctrl) return;
      panning = true;
      lastX   = e.clientX;
      lastY   = e.clientY;
      ctrl.autoRotate = false;
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!panning) return;
      const ctrl = globeRef.current?.controls();
      if (!ctrl?.object) return;
      const cam = ctrl.object;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // World-space distance per pixel — depends on camera distance and FOV
      const targetDistance = cam.position.distanceTo(ctrl.target);
      const halfH          = el.clientHeight / 2;
      const fovRad         = (cam.fov * Math.PI) / 180;
      const worldPerPixel  = (targetDistance * Math.tan(fovRad / 2)) / halfH;

      // Left/right pan along camera's local X axis
      tmpV.setFromMatrixColumn(cam.matrix, 0).multiplyScalar(-dx * worldPerPixel);
      panOffset.copy(tmpV);
      // Up/down pan along camera's local Y axis
      tmpV.setFromMatrixColumn(cam.matrix, 1).multiplyScalar(dy * worldPerPixel);
      panOffset.add(tmpV);

      ctrl.target.add(panOffset);
      cam.position.add(panOffset);
      panOffset.set(0, 0, 0);
    }

    function onMouseUp(e) {
      if (e.button !== 2) return;
      panning = false;
    }

    // Capture phase so we beat three-globe's pointer handlers
    el.addEventListener('mousedown', onMouseDown, { capture: true });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown, { capture: true });
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [isReady]);

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
