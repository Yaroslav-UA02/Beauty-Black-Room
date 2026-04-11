/* ══════════════════════════════════════════
   BEAUTY BLACK ROOM — THREE.JS
   1. Full-page particles
   2. Hero 3D Giraffe
   ══════════════════════════════════════════ */

/* ═══════ 1. GLOBAL PARTICLES ═══════ */
(function initGlobalParticles() {
  if (typeof THREE === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.id = 'globalCanvas';
  canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;';
  document.body.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  const count = 250;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const cols = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const pink = new THREE.Color(0xFF4FA3), purple = new THREE.Color(0x9D4FFF), white = new THREE.Color(0xFFFFFF);

  for (let i = 0; i < count; i++) {
    pos[i*3] = (Math.random()-.5)*16;
    pos[i*3+1] = (Math.random()-.5)*12;
    pos[i*3+2] = (Math.random()-.5)*8;
    speeds[i] = .001 + Math.random()*.003;
    const r = Math.random(), c = r<.35 ? pink : r<.6 ? purple : white;
    cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  const mat = new THREE.PointsMaterial({ size:.025, vertexColors:true, transparent:true, opacity:.5, sizeAttenuation:true });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  let pmx = 0, pmy = 0;
  document.addEventListener('mousemove', e => { pmx=(e.clientX/innerWidth-.5)*2; pmy=(e.clientY/innerHeight-.5)*2; });

  let frame = 0;
  (function loop() {
    requestAnimationFrame(loop);
    if (++frame % 2) return;
    const p = geo.attributes.position.array;
    for (let i=0;i<count;i++) { p[i*3+1]+=speeds[i]; if(p[i*3+1]>6){p[i*3+1]=-6;p[i*3]=(Math.random()-.5)*16;} }
    geo.attributes.position.needsUpdate = true;
    camera.position.x += (pmx*.5-camera.position.x)*.02;
    camera.position.y += (-pmy*.3-camera.position.y)*.02;
    camera.lookAt(0,0,0);
    pts.rotation.y += .0003;
    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();


/* ═══════ 2. GIRAFFE PARALLAX (mouse follow) ═══════ */
const giraffeEl = document.getElementById('heroGiraffe');
if (giraffeEl) {
  document.addEventListener('mousemove', e => {
    const cx = (e.clientX / innerWidth - .5) * 2;
    const cy = (e.clientY / innerHeight - .5) * 2;
    giraffeEl.style.transform = `translateY(${Math.sin(Date.now()*.001)*16}px) translate(${cx*12}px,${cy*8}px)`;
  });
}
