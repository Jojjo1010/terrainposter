import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { HeightmapResponse, Palette } from "@/types";
import { PALETTES } from "@/types";
import { usePosterStore } from "@/stores/posterStore";
import { useGlobeData } from "@/hooks/useGlobeData";

const SPHERE_RADIUS = 5;
const MAX_INSTANCES = 500_000;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(colors: string[], t: number): THREE.Color {
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

interface TerrainSpikesProps {
  heightmap: HeightmapResponse;
  palette: Palette;
}

function TerrainSpikes({ heightmap, palette }: TerrainSpikesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const colors = PALETTES[palette];

  const { count, matrices, instanceColors } = useMemo(() => {
    const { matrix, width, height, bounds, min_val, max_val } = heightmap;
    const range = max_val - min_val || 1;
    const dummy = new THREE.Object3D();
    const tempMatrices: THREE.Matrix4[] = [];
    const tempColors: THREE.Color[] = [];

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        if (tempMatrices.length >= MAX_INSTANCES) break;
        const val = matrix[row][col];
        if (val <= 0) continue;

        const t = (val - min_val) / range;
        const spikeHeight = t * 2;

        const lat = lerp(bounds.north, bounds.south, row / (height - 1));
        const lon = lerp(bounds.west, bounds.east, col / (width - 1));
        const [x, y, z] = latLonToCartesian(lat, lon, SPHERE_RADIUS);

        // Position and orient spike outward
        dummy.position.set(x, y, z);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
        // Offset so base sits on sphere surface
        dummy.translateY(spikeHeight / 2);
        dummy.scale.set(1, spikeHeight || 0.01, 1);
        dummy.updateMatrix();

        tempMatrices.push(dummy.matrix.clone());
        tempColors.push(lerpColor(colors, t));
      }
      if (tempMatrices.length >= MAX_INSTANCES) break;
    }

    return {
      count: tempMatrices.length,
      matrices: tempMatrices,
      instanceColors: tempColors,
    };
  }, [heightmap, colors]);

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
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.02, 1, 0.02]} />
      <meshStandardMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

function EarthSphere() {
  return (
    <mesh>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
      <meshStandardMaterial color="#1a2030" roughness={0.9} />
    </mesh>
  );
}

function Scene() {
  const palette = usePosterStore((s) => s.palette);
  const { data: heightmap } = useGlobeData();

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Stars radius={100} depth={50} count={3000} factor={4} fade speed={1} />
      <EarthSphere />
      {heightmap && <TerrainSpikes heightmap={heightmap} palette={palette} />}
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={20}
        rotateSpeed={0.5}
      />
    </>
  );
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      style={{ background: "#0B0B0B" }}
    >
      <Scene />
    </Canvas>
  );
}
