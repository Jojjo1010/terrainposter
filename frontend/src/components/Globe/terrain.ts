import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HeightmapResponse, Palette } from "@/types";
import { PALETTES } from "@/types";

const MAX_INSTANCES = 500_000;
const MIN_SPIKE_HEIGHT = 0.05;
const MAX_SPIKE_HEIGHT = 1.5;

// ---------------------------------------------------------------------------
// Utility: multi-stop color interpolation
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate through an array of hex color strings.
 * `t` is clamped to [0, 1].
 */
export function lerpColor(colors: string[], t: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, t));
  const segment = clamped * (colors.length - 1);
  const idx = Math.floor(segment);
  const frac = segment - idx;
  const c1 = new THREE.Color(colors[Math.min(idx, colors.length - 1)]);
  const c2 = new THREE.Color(colors[Math.min(idx + 1, colors.length - 1)]);
  return new THREE.Color(
    lerp(c1.r, c2.r, frac),
    lerp(c1.g, c2.g, frac),
    lerp(c1.b, c2.b, frac),
  );
}

// ---------------------------------------------------------------------------
// Utility: geographic → cartesian conversion
// ---------------------------------------------------------------------------

/**
 * Convert latitude / longitude (degrees) to a cartesian point on a sphere.
 *
 * Convention (matches Three.js Y-up):
 *   phi   = co-latitude  (0 at north pole, π at south pole)
 *   theta = longitude offset (0° mapped from −180°)
 */
function latLonToCartesian(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

// ---------------------------------------------------------------------------
// TerrainSpikes component
// ---------------------------------------------------------------------------

export interface TerrainSpikesProps {
  heightmap: HeightmapResponse;
  palette: Palette;
  sphereRadius: number;
}

/**
 * Renders data values from a HeightmapResponse as instanced spikes on a globe.
 *
 * Improvements over the inline Globe.tsx version:
 * - Logarithmic scaling so mega-cities don't dominate
 * - Proper min spike height so small values remain visible
 * - Spike base sits on the sphere surface (not inside it)
 * - Emissive material for visibility on the dark side
 */
export function TerrainSpikes({
  heightmap,
  palette,
  sphereRadius,
}: TerrainSpikesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colors = PALETTES[palette];

  const { count, matrices, instanceColors } = useMemo(() => {
    const { matrix, width, height, bounds, max_val } = heightmap;
    const dummy = new THREE.Object3D();
    const tempMatrices: THREE.Matrix4[] = [];
    const tempColors: THREE.Color[] = [];

    // Pre-compute log of max for normalisation
    const logMax = Math.log1p(max_val);
    if (logMax === 0) {
      return { count: 0, matrices: [] as THREE.Matrix4[], instanceColors: [] as THREE.Color[] };
    }

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (tempMatrices.length >= MAX_INSTANCES) break;

        const val = matrix[row][col];
        if (val <= 0) continue;

        // Logarithmic scaling — prevents mega-cities from dominating
        const scaledVal = Math.log1p(val) / logMax; // 0 → 1
        const spikeHeight = lerp(MIN_SPIKE_HEIGHT, MAX_SPIKE_HEIGHT, scaledVal);

        // Geographic position on sphere surface
        const lat = lerp(bounds.north, bounds.south, row / (height - 1));
        const lon = lerp(bounds.west, bounds.east, col / (width - 1));
        const [x, y, z] = latLonToCartesian(lat, lon, sphereRadius);

        // Orient spike to point radially outward
        dummy.position.set(x, y, z);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);

        // Offset so the spike base sits ON the surface, not half-inside it
        dummy.translateY(spikeHeight / 2);

        dummy.scale.set(1, spikeHeight, 1);
        dummy.updateMatrix();

        tempMatrices.push(dummy.matrix.clone());
        tempColors.push(lerpColor(colors, scaledVal));
      }
      if (tempMatrices.length >= MAX_INSTANCES) break;
    }

    return {
      count: tempMatrices.length,
      matrices: tempMatrices,
      instanceColors: tempColors,
    };
  }, [heightmap, colors, sphereRadius]);

  // Apply matrices and colors to the instanced mesh
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, instanceColors[i]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, matrices, instanceColors]);

  if (count === 0) return null;

  return (
    // @ts-expect-error — R3F JSX for InstancedMesh
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.02, 1, 0.02]} />
      <meshStandardMaterial
        vertexColors
        toneMapped={false}
        emissive="#ffffff"
        emissiveIntensity={0.3}
      />
    </instancedMesh>
  );
}
