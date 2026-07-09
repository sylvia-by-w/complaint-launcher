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
earthImage.src = 'assets/earth-realistic.png';

function nebulaCenter() {
  return { x: W * 0.5, y: H * 0.34 };
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
  const spread = 40 + Math.min(260, totalChars * 0.5);

  chars.forEach((ch, i) => {
    const startX = rect.left + rect.width * (0.15 + 0.7 * Math.random());
    const startY = rect.top + rect.height * 0.4;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spread + 20;
    const targetX = center.x + Math.cos(angle) * radius;
    const targetY = center.y + Math.sin(angle) * radius * 0.55;

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
      angle, radius
    });
  });

  totalChars += chars.length;
  totalMsgs += 1;
  updateCounter();
  input.value = '';
}

function updateCounter() {
  counterEl.textContent = `已发射 ${totalMsgs} 条烦恼 · ${totalChars} 颗星`;
}

launchBtn.addEventListener('click', launch);
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

  const earthSize = Math.min(W, H) * 0.48;
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

  // deep space gradient
  const g = ctx.createRadialGradient(W * 0.5, H * 0.34, 0, W * 0.5, H * 0.34, Math.max(W, H) * 0.75);
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

  // persistent nebula stars, slowly orbiting
  const center = nebulaCenter();
  drawEarth(center, now);
  nebulaStars.forEach(s => {
    const ang = s.baseAngle + now * s.angularSpeed;
    const x = center.x + Math.cos(ang) * s.radius;
    const y = center.y + Math.sin(ang) * s.radius * 0.55;
    const twinkle = 0.7 + 0.3 * Math.sin(now * 0.002 + s.baseAngle * 5);
    ctx.save();
    ctx.globalAlpha = twinkle;
    ctx.shadowBlur = 14;
    ctx.shadowColor = s.color;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

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
        color: p.color
      });
      return false;
    }
  });

  requestAnimationFrame(draw);
}

resize();
requestAnimationFrame(draw);
