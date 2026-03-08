import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { usePosterStore } from "@/stores/posterStore";
import { useGlobeData } from "@/hooks/useGlobeData";
import { TerrainSpikes } from "@/components/Globe/terrain";
import {
  atmosphereVertexShader,
  atmosphereFragmentShader,
  innerGlowFragmentShader,
} from "@/components/Globe/shaders";

const SPHERE_RADIUS = 5;

// --- Texture URLs (NASA Blue Marble via three-globe CDN) ---
const EARTH_DAY_MAP =
  "https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg";
const EARTH_BUMP_MAP =
  "https://unpkg.com/three-globe@2.41.12/example/img/earth-topology.png";
const NIGHT_SKY_MAP =
  "https://unpkg.com/three-globe@2.41.12/example/img/night-sky.png";

// --- Utility ---

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

// --- Atmosphere glow (blue-white, Google Earth style) ---

function Atmosphere() {
  return (
    <mesh scale={[1.12, 1.12, 1.12]}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// --- Subtle inner rim light on the globe surface ---

function InnerGlow() {
  return (
    <mesh scale={[1.005, 1.005, 1.005]}>
      <sphereGeometry args={[SPHERE_RADIUS, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={innerGlowFragmentShader}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// --- Space background (night sky panorama on large inverted sphere) ---

function SpaceBackground() {
  const texture = useTexture(NIGHT_SKY_MAP);

  useEffect(() => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);

  return (
    <mesh>
      <sphereGeometry args={[500, 64, 64]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

// --- Latitude/longitude grid lines ---

function Graticule() {
  const lines = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    const R = SPHERE_RADIUS + 0.01;
    const segments = 180;

    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const lon = (i / segments) * 360;
        const [x, y, z] = latLonToCartesian(lat, lon, R);
        pts.push(new THREE.Vector3(x, y, z));
      }
      result.push(new THREE.BufferGeometry().setFromPoints(pts));
    }

    for (let lon = 0; lon < 360; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const lat = -90 + (i / segments) * 180;
        const [x, y, z] = latLonToCartesian(lat, lon, R);
        pts.push(new THREE.Vector3(x, y, z));
      }
      result.push(new THREE.BufferGeometry().setFromPoints(pts));
    }

    return result;
  }, []);

  return (
    <group>
      {lines.map((geo, i) => (
        <line key={i} geometry={geo}>
          <lineBasicMaterial
            color="#aac4e0"
            transparent
            opacity={0.04}
            depthWrite={false}
          />
        </line>
      ))}
    </group>
  );
}

// --- Earth sphere with NASA Blue Marble textures ---

function EarthSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  const [dayMap, bumpMap] = useTexture([EARTH_DAY_MAP, EARTH_BUMP_MAP]);

  useEffect(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = 8;
  }, [dayMap]);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[SPHERE_RADIUS, 128, 128]} />
      <meshPhongMaterial
        map={dayMap}
        bumpMap={bumpMap}
        bumpScale={0.04}
        specular={new THREE.Color("#1a2a3a")}
        shininess={15}
      />
    </mesh>
  );
}

// --- Main scene ---

function Scene() {
  const palette = usePosterStore((s) => s.palette);
  const { data: heightmap } = useGlobeData();

  return (
    <>
      {/* Lighting — Sun-like key light from one side, very dim ambient for dark side */}
      <ambientLight intensity={0.08} color="#1a1a2e" />
      <directionalLight position={[10, 5, 8]} intensity={1.4} color="#fff8f0" />
      <directionalLight
        position={[-6, -2, -8]}
        intensity={0.06}
        color="#4a6080"
      />

      {/* Deep space background with Milky Way texture */}
      <SpaceBackground />

      {/* Globe layers */}
      <EarthSphere />
      <Graticule />
      <InnerGlow />
      <Atmosphere />

      {/* Data */}
      {heightmap && (
        <TerrainSpikes
          heightmap={heightmap}
          palette={palette}
          sphereRadius={SPHERE_RADIUS}
        />
      )}

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={25}
        rotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  );
}

export default function Globe() {
  return (
    <Canvas
      camera={{ position: [0, 2, 14], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "#000000" }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <Scene />
    </Canvas>
  );
}
