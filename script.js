const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const input = document.getElementById('input');
const launchBtn = document.getElementById('launchBtn');
const counterEl = document.getElementById('counter');

let W, H, DPR;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildBackgroundStars();
}
window.addEventListener('resize', resize);

// ---------- background twinkle stars ----------
let bgStars = [];
function buildBackgroundStars() {
  const count = Math.floor((W * H) / 6000);
  bgStars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.2 + 0.2,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.0015 + 0.0005
  }));
}

// ---------- nebula (persistent settled stars) ----------
const PALETTE = ['#ffffff', '#c9b6ff', '#a78bfa', '#7dd3fc', '#f9a8ff', '#fef08a'];
let nebulaStars = [];
let totalChars = 0;
let totalMsgs = 0;
const earthImage = new Image();
earthImage.src = 'assets/earth.png';

function nebulaCenter() {
  return { x: W * 0.5, y: H * 0.5 };
}

// the settled stars form a flattened ring around the globe, like Saturn's
// rings, instead of a filled cloud
const RING_FLATTEN = 0.32;
function earthRadius() {
  return Math.min(W, H) * 0.64 / 2;
}
function ringBand() {
  const r = earthRadius();
  const inner = r * 1.18;
  const width = r * (0.35 + Math.min(0.55, totalChars * 0.0035));
  return { inner, width };
}

// ---------- occasional shooting stars, purely decorative ----------
let shootingStars = [];
let nextShootAt = performance.now() + 6000 + Math.random() * 8000;
function maybeSpawnShootingStar(now) {
  if (now < nextShootAt) return;
  nextShootAt = now + 14000 + Math.random() * 16000;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -40 : W + 40;
  const startY = Math.random() * H * 0.5;
  const speed = (W + H) * (0.55 + Math.random() * 0.25) / 900;
  const dir = fromLeft ? 1 : -1;
  shootingStars.push({
    x: startX, y: startY,
    vx: dir * speed, vy: speed * (0.45 + Math.random() * 0.2),
    len: 90 + Math.random() * 90,
    start: now,
    duration: 700 + Math.random() * 300
  });
}
function drawShootingStars(now) {
  shootingStars = shootingStars.filter(s => {
    const t = (now - s.start) / s.duration;
    if (t > 1) return false;
    const x = s.x + s.vx * (now - s.start);
    const y = s.y + s.vy * (now - s.start);
    const angle = Math.atan2(s.vy, s.vx);
    const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-s.len, 0, 0, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s.len, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.restore();
    return true;
  });
}

// ---------- active flying particles ----------
let particles = [];

function launch() {
  const text = input.value.trim();
  if (!text) {
    input.style.borderColor = 'rgba(255,90,90,0.8)';
    setTimeout(() => (input.style.borderColor = ''), 350);
    return;
  }
  const chars = [...text].filter(c => c.trim().length > 0);
  const rect = input.getBoundingClientRect();
  const center = nebulaCenter();
  const { inner, width } = ringBand();
  const batch = totalMsgs;
  // each message clusters into its own little arc of the ring, spread out in
  // character order, so a burst reads as a small constellation rather than
  // scattering fully at random
  const baseAngle = Math.random() * Math.PI * 2;
  const angleSpan = Math.min(1.1, 0.18 + chars.length * 0.06);

  chars.forEach((ch, i) => {
    const startX = rect.left + rect.width * (0.15 + 0.7 * Math.random());
    const startY = rect.top + rect.height * 0.4;
    const t = chars.length > 1 ? i / (chars.length - 1) : 0.5;
    const angle = baseAngle + (t - 0.5) * angleSpan + (Math.random() - 0.5) * 0.05;
    const radius = inner + Math.random() * width;
    const targetX = center.x + Math.cos(angle) * radius;
    const targetY = center.y + Math.sin(angle) * radius * RING_FLATTEN;

    const ctrlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 260;
    const ctrlY = Math.min(startY, targetY) - 160 - Math.random() * 180;

    particles.push({
      char: ch,
      p0: { x: startX, y: startY },
      p1: { x: ctrlX, y: ctrlY },
      p2: { x: targetX, y: targetY },
      start: performance.now() + i * 35,
      duration: 1500 + Math.random() * 900,
      rotSpeed: (Math.random() - 0.5) * 6,
      size: 13 + Math.random() * 4,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      angle, radius, batch, seq: i
    });
  });

  totalChars += chars.length;
  totalMsgs += 1;
  updateCounter();
  input.value = '';
}

let counterBumpTimer = null;
function updateCounter() {
  counterEl.textContent = `已发射 ${totalMsgs} 条烦恼 · ${totalChars} 颗星`;
  counterEl.classList.add('bump');
  clearTimeout(counterBumpTimer);
  counterBumpTimer = setTimeout(() => counterEl.classList.remove('bump'), 400);
}

launchBtn.addEventListener('click', launch);
launchBtn.addEventListener('click', e => {
  const rect = launchBtn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.8;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left) + 'px';
  ripple.style.top = (e.clientY - rect.top) + 'px';
  launchBtn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    launch();
  }
});

function bezierPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  };
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function drawEarth(center, now) {
  if (!earthImage.complete) return;

  const earthSize = Math.min(W, H) * 0.64;
  const bobY = Math.sin(now * 0.0007) * 4;
  const pulse = 1 + Math.sin(now * 0.0011) * 0.004;

  ctx.save();
  ctx.translate(center.x, center.y + bobY);
  ctx.scale(pulse, pulse);

  const glow = ctx.createRadialGradient(0, 0, earthSize * 0.1, 0, 0, earthSize * 0.95);
  glow.addColorStop(0, 'rgba(150, 245, 255, 0.32)');
  glow.addColorStop(0.5, 'rgba(95, 150, 255, 0.16)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, earthSize * 0.95, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(earthImage, -earthSize / 2, -earthSize / 2, earthSize, earthSize);
  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, W, H);

  const center = nebulaCenter();

  // deep space gradient, centered on the same point as the globe
  const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(60,30,110,0.35)');
  g.addColorStop(0.5, 'rgba(15,10,35,0.15)');
  g.addColorStop(1, 'rgba(5,6,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // twinkling background stars
  bgStars.forEach(s => {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(now * s.speed + s.phase));
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  maybeSpawnShootingStar(now);
  drawShootingStars(now);

  // persistent nebula stars form a ring around the globe; the half of the
  // ring that's "behind" the globe is drawn first, then the globe, then the
  // near half on top, so the ring appears to pass behind the planet. depth
  // (how close to the viewer a point on the ring is) also scales size and
  // brightness a little, so the ring reads as a tilted circle, not flat dots.
  const ringPoints = nebulaStars.map(s => {
    const ang = s.baseAngle + now * s.angularSpeed;
    const depth = (Math.sin(ang) + 1) / 2; // 0 = far/behind, 1 = near/front
    return {
      s, ang, depth,
      x: center.x + Math.cos(ang) * s.radius,
      y: center.y + Math.sin(ang) * s.radius * RING_FLATTEN,
      behind: Math.sin(ang) < 0
    };
  });

  const drawRingGroup = pts => {
    // faint constellation lines linking characters launched in the same burst
    const byBatch = new Map();
    pts.forEach(p => {
      if (!byBatch.has(p.s.batch)) byBatch.set(p.s.batch, []);
      byBatch.get(p.s.batch).push(p);
    });
    byBatch.forEach(list => {
      if (list.length < 2) return;
      list.sort((a, b) => a.s.seq - b.s.seq);
      ctx.save();
      ctx.strokeStyle = 'rgba(200,190,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      list.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    });

    pts.forEach(p => {
      const s = p.s;
      const sizeScale = 0.65 + 0.45 * p.depth;
      const twinkle = (0.55 + 0.35 * p.depth) * (0.85 + 0.15 * Math.sin(now * 0.002 + s.baseAngle * 5));
      ctx.save();
      ctx.globalAlpha = twinkle;
      ctx.shadowBlur = 14 * sizeScale;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.size * sizeScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  drawRingGroup(ringPoints.filter(p => p.behind));
  drawEarth(center, now);
  drawRingGroup(ringPoints.filter(p => !p.behind));

  // active flying particles
  particles = particles.filter(p => {
    if (now < p.start) return true;
    const t = Math.min(1, (now - p.start) / p.duration);
    const ease = easeOutCubic(t);
    const pos = bezierPoint(p.p0, p.p1, p.p2, ease);

    if (t < 1) {
      const textAlpha = Math.max(0, 1 - t * 2.2);
      const starAlpha = Math.min(1, t * 2.2);

      if (textAlpha > 0.02) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(t * p.rotSpeed);
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c9b6ff';
        ctx.font = `${p.size + 4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      }
      if (starAlpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = starAlpha;
        ctx.shadowBlur = 16;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return true;
    } else {
      nebulaStars.push({
        baseAngle: p.angle,
        radius: p.radius,
        angularSpeed: (Math.random() * 0.00006 + 0.00002) * (Math.random() < 0.5 ? 1 : -1),
        size: p.size * 0.3,
        color: p.color,
        batch: p.batch,
        seq: p.seq
      });
      return false;
    }
  });

  requestAnimationFrame(draw);
}

resize();
requestAnimationFrame(draw);
