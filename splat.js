import * as THREE from "three";

export function loadImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

// The Gaussian's in-plane covariance is projected with the reconstructed face.
// Color comes from the generated image, sampled across the Gaussian footprint.
export function splatSurface(parent, image, bottomLeft, bottomRight, topLeft, topRight, gain, region) {
  const texture = new THREE.Texture(image);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  const quad = new THREE.PlaneGeometry(2, 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute("position", quad.getAttribute("position"));
  geometry.setIndex(quad.index);
  const columnsRows = new THREE.Vector2();
  const width = (bottomLeft.distanceTo(bottomRight) + topLeft.distanceTo(topRight)) / 2;
  const height = (bottomLeft.distanceTo(topLeft) + bottomRight.distanceTo(topRight)) / 2;
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    uniforms: {
      colorMap: { value: texture }, grid: { value: columnsRows }, gain: { value: gain },
      region: { value: new THREE.Vector4(...region) },
      bottomLeft: { value: bottomLeft }, bottomRight: { value: bottomRight },
      topLeft: { value: topLeft }, topRight: { value: topRight },
    },
    vertexShader: `
      precision highp float;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform vec3 bottomLeft, bottomRight, topLeft, topRight;
      uniform vec2 grid;
      in vec3 position;
      out vec2 local;
      out vec2 photoUV;
      void main() {
        int width = int(grid.x);
        vec2 center = (vec2(gl_InstanceID % width, gl_InstanceID / width) + .5) / grid;
        local = position.xy * 2.7;
        photoUV = center + local * .76 / grid;
        vec3 lower = mix(bottomLeft, bottomRight, photoUV.x);
        vec3 upper = mix(topLeft, topRight, photoUV.x);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(lower, upper, photoUV.y), 1.);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D colorMap;
      uniform float gain;
      uniform vec4 region;
      in vec2 local;
      in vec2 photoUV;
      out vec4 fragment;
      void main() {
        float r2 = dot(local, local);
        if (r2 > 7.29 || any(lessThan(photoUV, vec2(0.))) || any(greaterThan(photoUV, vec2(1.)))) discard;
        vec4 pigment = texture(colorMap, mix(region.xy, region.zw, photoUV));
        if (pigment.a < .05) discard;
        fragment = vec4(pigment.rgb * gain, pigment.a * .97 * exp(-.5 * r2));
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  parent.add(mesh);
  let previous = 0;
  return (density) => {
    if (density === previous) return;
    previous = density;
    const cols = Math.max(2, Math.ceil(width * density));
    const rows = Math.max(2, Math.ceil(height * density));
    columnsRows.set(cols, rows);
    geometry.instanceCount = cols * rows;
  };
}
