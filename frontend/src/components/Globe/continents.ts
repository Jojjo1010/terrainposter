import { useMemo } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Simplified continent outlines for geographic reference on the globe.
//
// Each continent is a list of [lat, lon] waypoints tracing a rough coastline.
// These are intentionally coarse (200-300 pts per major landmass) — they only
// serve as subtle guides when a data overlay obscures the Blue Marble texture.
// ---------------------------------------------------------------------------

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

type LatLon = [number, number];

// --- Africa (~90 points) ---
const AFRICA: LatLon[] = [
  [37.5, -5.5], [36.8, 2], [37.1, 10], [33, 12], [32.5, 15],
  [30.5, 18], [31, 25], [31.5, 32], [29, 33], [25, 35],
  [22, 36.5], [18, 38], [15, 42], [12, 44], [11.5, 51],
  [10, 51.5], [5, 48], [2, 45], [-1, 42], [-4.5, 39.5],
  [-6, 37.5], [-10, 40], [-12, 43], [-15, 41], [-20, 44],
  [-25, 47], [-26, 33], [-34, 26], [-34, 18], [-31, 17],
  [-29, 16.5], [-22, 14], [-17, 11], [-12, 14], [-5, 12],
  [0, 9.5], [4, 7], [5, 3], [6, 1], [5, -3],
  [4, -7], [5, -10], [7, -12.5], [10, -15], [12, -17],
  [15, -17], [18, -16], [20, -17], [23, -15.5], [25, -14.5],
  [28, -13], [32, -9], [34, -2], [35.5, -1], [37.5, -5.5],
];

// --- Europe (~70 points) ---
const EUROPE: LatLon[] = [
  [36, -9], [37, -7], [38.5, -9], [42, -9], [43.5, -8],
  [43.5, -1.5], [46, -1], [47, -4], [48.5, -5], [50, -5],
  [51, 1], [52, 4], [54, 8], [55, 8], [57, 10],
  [58, 12], [59, 18], [56, 18], [54.5, 14], [54, 10],
  [55, 12], [57.5, 18], [60, 20], [63, 20], [65, 14],
  [69, 16], [71, 25.5], [70, 30], [67, 41], [62, 40],
  [60, 30], [57, 28], [55, 20.5], [54, 23], [50, 40],
  [46, 42], [42, 43], [42, 41], [41, 29], [40, 26],
  [38, 24], [36, 23], [38, 21], [40, 20], [39, 16],
  [41, 17], [42, 14], [44, 12.5], [44, 8], [43, 5],
  [42, 3], [40, 0], [37, -2], [36, -5], [36, -9],
];

// --- Asia (roughly; Eurasia eastern half) (~100 points) ---
const ASIA: LatLon[] = [
  [42, 43], [43, 52], [40, 53], [37, 56], [35, 51],
  [30, 48], [26, 50], [24, 55], [22, 59], [17, 54],
  [13, 44], [12.5, 43.5], [15, 42], [18, 38], [22, 36.5],
  [25, 35], [29, 33], [31.5, 32], [33, 35], [35, 36],
  [37, 36], [39, 44], [42, 43],
];

const ASIA_EAST: LatLon[] = [
  [50, 40], [52, 55], [48, 60], [43, 68], [40, 68],
  [38, 75], [35, 72], [30, 67], [24, 68], [20, 73],
  [15, 80], [8, 77], [6, 80.5], [1, 104], [3, 108],
  [7, 110], [10, 109], [12, 109], [18, 106], [21, 107],
  [22, 108], [21, 110], [24, 118], [30, 122], [34, 120],
  [38, 118], [39, 122], [40, 124], [42, 130], [46, 136],
  [50, 140], [53, 141], [58, 150], [60, 163], [64, 178],
  [66, 170], [69, 180], [70, 170], [68, 163], [66, 150],
  [60, 150], [56, 138], [52, 130], [55, 120], [58, 110],
  [55, 73], [60, 68], [65, 70], [70, 67], [72, 80],
  [72, 100], [73, 120], [75, 140], [71, 180], [68, 170],
  [65, 175], [64, 178],
];

// --- North America (~80 points) ---
const NORTH_AMERICA: LatLon[] = [
  [8, -77], [10, -84], [15, -88], [18, -88], [20, -90],
  [21, -87], [25, -90], [29, -89], [30, -85], [25, -80],
  [27, -80], [30, -81.5], [32, -80], [35, -75.5], [38, -75],
  [40, -74], [42, -70], [44, -67], [46, -60], [47, -53],
  [52, -56], [55, -60], [58, -64], [60, -64], [62, -76],
  [66, -62], [70, -54], [72, -56], [76, -68], [72, -80],
  [70, -100], [72, -120], [71, -140], [68, -165], [65, -168],
  [60, -165], [57, -157], [56, -154], [60, -150], [60, -140],
  [55, -130], [50, -128], [48, -124], [42, -124], [38, -123],
  [34, -118], [32, -117], [25, -110], [22, -106], [20, -105],
  [16, -96], [14, -92], [10, -84], [8, -77],
];

// --- South America (~60 points) ---
const SOUTH_AMERICA: LatLon[] = [
  [13, -72], [12, -72], [10, -67], [8, -60], [5, -52],
  [2, -50], [-2, -44], [-5, -35], [-8, -35], [-13, -38.5],
  [-18, -39], [-22, -41], [-23, -44], [-28, -48.5], [-33, -52],
  [-38, -57], [-42, -65], [-46, -67], [-52, -68.5], [-54, -68],
  [-55, -66], [-53, -71], [-48, -75.5], [-42, -73], [-37, -73.5],
  [-33, -72], [-27, -71], [-23, -70], [-18, -70], [-15, -75],
  [-5, -81], [0, -80], [2, -78], [7, -77], [10, -75],
  [12, -72], [13, -72],
];

// --- Australia (~40 points) ---
const AUSTRALIA: LatLon[] = [
  [-12, 136], [-12, 131], [-15, 129], [-14, 126.5], [-20, 119],
  [-22, 114], [-26, 113.5], [-30, 115], [-34, 115.5], [-35, 117.5],
  [-35, 137], [-38, 141], [-38, 146], [-37, 150], [-34, 151],
  [-28, 153.5], [-24, 152], [-20, 149], [-19, 146.5], [-16, 146],
  [-14, 144], [-12, 142], [-11, 136], [-12, 136],
];

// --- Antarctica (rough outline ~40 points) ---
const ANTARCTICA: LatLon[] = [
  [-70, -60], [-72, -40], [-70, -25], [-69, 0], [-68, 20],
  [-67, 40], [-67, 60], [-68, 80], [-66, 100], [-66, 120],
  [-67, 140], [-70, 160], [-75, 170], [-78, 180], [-78, -170],
  [-74, -140], [-72, -120], [-73, -100], [-75, -80], [-70, -60],
];

const ALL_CONTINENTS: LatLon[][] = [
  AFRICA,
  EUROPE,
  ASIA,
  ASIA_EAST,
  NORTH_AMERICA,
  SOUTH_AMERICA,
  AUSTRALIA,
  ANTARCTICA,
];

// ---------------------------------------------------------------------------
// ContinentOutlines component
// ---------------------------------------------------------------------------

export interface ContinentOutlinesProps {
  sphereRadius: number;
  visible?: boolean;
}

/**
 * Renders very subtle continent outlines on the globe surface.
 *
 * Primarily useful when a data overlay obscures the underlying Blue Marble
 * texture. When the texture is clearly visible these can stay hidden.
 */
export function ContinentOutlines({
  sphereRadius,
  visible = true,
}: ContinentOutlinesProps) {
  const geometries = useMemo(() => {
    const R = sphereRadius + 0.02; // slight offset above the sphere surface
    return ALL_CONTINENTS.map((outline) => {
      const points = outline.map(([lat, lon]) => {
        const [x, y, z] = latLonToCartesian(lat, lon, R);
        return new THREE.Vector3(x, y, z);
      });
      return new THREE.BufferGeometry().setFromPoints(points);
    });
  }, [sphereRadius]);

  if (!visible) return null;

  return (
    // @ts-expect-error — R3F group JSX
    <group>
      {geometries.map((geo, i) => (
        // @ts-expect-error — R3F line JSX
        <line key={i} geometry={geo}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </line>
      ))}
    </group>
  );
}
