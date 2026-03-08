import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

// --- Atmosphere glow with gradient falloff ---

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Gradient glow: warm near the surface, fading to transparent
const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);

    // Soft gradient: multiple falloff layers blended
    float innerGlow = pow(rim, 6.0) * 0.6;   // tight bright edge
    float midGlow = pow(rim, 3.0) * 0.2;      // mid spread
    float outerGlow = pow(rim, 1.5) * 0.06;   // wide soft haze

    float glow = innerGlow + midGlow + outerGlow;

    // Warm color gradient: golden near edge → soft amber → transparent
    vec3 warmInner = vec3(1.0, 0.85, 0.5);    // golden
    vec3 warmOuter = vec3(0.9, 0.65, 0.3);    // amber
    vec3 color = mix(warmOuter, warmInner, pow(rim, 2.0));

    gl_FragColor = vec4(color, glow);
  }
`;

function Atmosphere() {
  return (
    <mesh scale={[1.25, 1.25, 1.25]}>
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

const innerGlowFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float glow = pow(rim, 4.0) * 0.25;
    vec3 color = vec3(1.0, 0.9, 0.6); // warm soft gold
    gl_FragColor = vec4(color, glow);
  }
`;

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

// --- Static stars (no animation, no flickering) ---

function StaticStars() {
  const geometry = useMemo(() => {
    const count = 4000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute on a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 200 + Math.random() * 300;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={1.2}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
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
            color="#d4a46a"
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </line>
      ))}
    </group>
  );
}

// --- Terrain spikes ---

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

        dummy.position.set(x, y, z);
        dummy.lookAt(0, 0, 0);
        dummy.rotateX(Math.PI / 2);
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

// --- Earth sphere ---

function EarthSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[SPHERE_RADIUS, 128, 128]} />
      <meshPhongMaterial
        color="#0c1420"
        emissive="#12192a"
        emissiveIntensity={0.25}
        specular="#3a3020"
        shininess={8}
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
      {/* Lighting — warm key light, cool fill */}
      <ambientLight intensity={0.1} color="#2a2a3a" />
      <directionalLight position={[10, 8, 5]} intensity={1.0} color="#fff5e0" />
      <directionalLight
        position={[-8, -4, -6]}
        intensity={0.15}
        color="#a08060"
      />

      {/* Static stars — no flickering */}
      <StaticStars />

      {/* Globe layers */}
      <EarthSphere />
      <Graticule />
      <InnerGlow />
      <Atmosphere />

      {/* Data */}
      {heightmap && <TerrainSpikes heightmap={heightmap} palette={palette} />}

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
