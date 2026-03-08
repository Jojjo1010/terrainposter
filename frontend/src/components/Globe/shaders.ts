// Atmosphere shaders — realistic blue-white atmospheric scattering
// Inspired by Google Earth's thin bright atmospheric rim

export const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);

    // Three falloff layers for smooth gradient
    float inner = pow(rim, 6.0) * 0.7;   // bright tight edge
    float mid = pow(rim, 3.0) * 0.15;    // mid spread
    float outer = pow(rim, 1.5) * 0.04;  // wide subtle haze
    float glow = inner + mid + outer;

    // Blue-white atmospheric color (NOT golden)
    vec3 innerColor = vec3(0.72, 0.83, 0.94);  // #b8d4f0
    vec3 outerColor = vec3(0.29, 0.56, 0.85);  // #4a90d9
    vec3 color = mix(outerColor, innerColor, pow(rim, 2.0));

    gl_FragColor = vec4(color, glow);
  }
`;

// Subtle inner atmospheric rim on the globe surface (front-facing)
export const innerGlowFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float glow = pow(rim, 4.0) * 0.15;
    vec3 color = vec3(0.6, 0.78, 0.95); // soft blue
    gl_FragColor = vec4(color, glow);
  }
`;
