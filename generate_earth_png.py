import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter

rng_seed = 11

def fractal_noise(h, w, beta=2.0, seed=0, low_cut=1.0):
    rng = np.random.default_rng(seed)
    noise = rng.normal(size=(h, w))
    F = np.fft.fft2(noise)
    fy = np.fft.fftfreq(h).reshape(-1, 1)
    fx = np.fft.fftfreq(w).reshape(1, -1)
    freq = np.sqrt(fx * fx + fy * fy)
    freq[0, 0] = low_cut / max(h, w)
    amp = 1.0 / np.power(freq, beta / 2.0)
    F *= amp
    img = np.fft.ifft2(F).real
    img -= img.min()
    img /= (img.max() + 1e-9)
    return img

def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0 + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)

def warp2d(field, warp_x, warp_y, max_shift_x, max_shift_y):
    h, w = field.shape
    rows = np.arange(h).reshape(-1, 1)
    cols = np.arange(w).reshape(1, -1)
    xi = (cols + (warp_x - 0.5) * max_shift_x).astype(int) % w
    yi = np.clip((rows + (warp_y - 0.5) * max_shift_y).astype(int), 0, h - 1)
    return field[yi, xi]

SIZE = 1600
R = SIZE // 2 - 6
NLON, NLAT = 1024, 512

continent   = fractal_noise(NLAT, NLON, beta=2.3, seed=rng_seed)
warp_x1     = fractal_noise(NLAT, NLON, beta=3.3, seed=rng_seed + 10)
warp_y1     = fractal_noise(NLAT, NLON, beta=3.3, seed=rng_seed + 11)

continent_w = warp2d(continent, warp_x1, warp_y1, 220, 80)
continent_w = gaussian_filter(continent_w, sigma=2.0, mode='wrap')

detail  = fractal_noise(NLAT, NLON, beta=1.3, seed=rng_seed + 1)
detail2 = fractal_noise(NLAT, NLON, beta=0.8, seed=rng_seed + 2)
elevation = continent_w * 0.82 + detail * 0.13 + detail2 * 0.05
elevation = gaussian_filter(elevation, sigma=1.0, mode='wrap')

land_frac = 0.27
land_thresh = np.percentile(elevation, (1 - land_frac) * 100)

cloud_base = fractal_noise(NLAT, NLON, beta=1.7, seed=rng_seed + 3)
cloud_warp = fractal_noise(NLAT, NLON, beta=2.2, seed=rng_seed + 4)
lon_idx = (np.arange(NLON).reshape(1, -1) + (cloud_warp - 0.5) * 90).astype(int) % NLON
cloud_warped = cloud_base[np.arange(NLAT).reshape(-1, 1), lon_idx]
cloud_field = gaussian_filter(cloud_warped, sigma=1.2)

ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float64)
cx = cy = SIZE / 2.0
nx = (xs - cx) / R
ny = (ys - cy) / R
r2 = nx * nx + ny * ny
mask = r2 <= 1.0
nz = np.zeros_like(nx)
nz[mask] = np.sqrt(1.0 - r2[mask])

Nx, Ny, Nz = nx, -ny, nz

lat = np.arcsin(np.clip(Ny, -1, 1))
lon = np.arctan2(Nx, Nz)

lon_f = ((lon / (2 * np.pi) + 0.5) * NLON) % NLON
lat_f = np.clip((lat / np.pi + 0.5) * NLAT, 0, NLAT - 1)

lon0 = lon_f.astype(int) % NLON
lon1 = (lon0 + 1) % NLON
lat0 = lat_f.astype(int).clip(0, NLAT - 1)
lat1 = (lat0 + 1).clip(0, NLAT - 1)
fu = lon_f - lon0
fv = lat_f - lat0

def bilinear(field):
    a = field[lat0, lon0] * (1 - fu) + field[lat0, lon1] * fu
    b = field[lat1, lon0] * (1 - fu) + field[lat1, lon1] * fu
    return a * (1 - fv) + b * fv

elev_p = bilinear(elevation)
cloud_p = bilinear(cloud_field)
detail_p = bilinear(detail)

is_land = elev_p > land_thresh
land_h = np.clip((elev_p - land_thresh) / (1 - land_thresh + 1e-9), 0, 1)
ocean_depth = np.clip((land_thresh - elev_p) / (land_thresh + 1e-9), 0, 1)

abslat = np.abs(lat) / (np.pi / 2)
ice = smoothstep(0.80, 0.95, abslat) * (1 - 0.4 * smoothstep(0.0, 0.3, land_h))
desert_band = smoothstep(0.28, 0.42, abslat) * (1 - smoothstep(0.5, 0.65, abslat))

deep = np.array([14, 58, 120])
shallow = np.array([56, 140, 190])
ocean_col = deep[None, None, :] * (1 - ocean_depth[..., None]) + shallow[None, None, :] * ocean_depth[..., None]
ocean_col = ocean_col * (0.94 + 0.10 * detail_p[..., None])

low_land = np.array([58, 108, 50])
mid_land = np.array([138, 122, 66])
high_land = np.array([172, 164, 150])
snow = np.array([248, 250, 252])

land_col = (
    low_land[None, None, :] * (1 - smoothstep(0.0, 0.55, land_h))[..., None]
    + mid_land[None, None, :] * (smoothstep(0.0, 0.55, land_h) * (1 - smoothstep(0.55, 0.85, land_h)))[..., None]
    + high_land[None, None, :] * smoothstep(0.55, 0.85, land_h)[..., None]
)
desert_col = np.array([194, 164, 98])
land_col = land_col * (1 - desert_band[..., None] * 0.55) + desert_col[None, None, :] * (desert_band[..., None] * 0.55)
land_col = land_col * (0.92 + 0.16 * detail_p[..., None])

col = np.where(is_land[..., None], land_col, ocean_col)
col = col * (1 - ice[..., None]) + snow[None, None, :] * ice[..., None]

L = np.array([0.30, 0.22, 0.93])
L = L / np.linalg.norm(L)
ndotl = Nx * L[0] + Ny * L[1] + Nz * L[2]
ambient = 0.6
shade = ambient + (1 - ambient) * np.power(np.clip((ndotl + 1) / 2, 0, 1), 0.8)
lit = col * shade[..., None]

Vx, Vy, Vz = 0.0, 0.0, 1.0
Hx, Hy, Hz = L[0] + Vx, L[1] + Vy, L[2] + Vz
hn = np.sqrt(Hx * Hx + Hy * Hy + Hz * Hz)
Hx, Hy, Hz = Hx / hn, Hy / hn, Hz / hn
ndoth = np.clip(Nx * Hx + Ny * Hy + Nz * Hz, 0, 1)
spec = np.power(ndoth, 130) * (~is_land) * 0.5
spec = gaussian_filter(spec, sigma=4.0)
spec_col = np.clip(spec, 0, 1)[..., None] * np.array([215, 232, 255])
lit = lit + spec_col

cloud_cov = smoothstep(0.60, 0.88, cloud_p)
cloud_shaded = cloud_cov * (0.55 + 0.45 * shade)
lit = lit * (1 - cloud_shaded[..., None] * 0.8) + np.array([255, 255, 255])[None, None, :] * (cloud_shaded[..., None] * 0.8)

lit = np.clip(lit, 0, 255)

fres = np.power(1 - np.clip(Nz, 0, 1), 3.0)
rim_col = np.array([150, 205, 255])
lit = lit * (1 - fres[..., None] * 0.4) + rim_col[None, None, :] * (fres[..., None] * 0.4)
lit = np.clip(lit, 0, 255)

alpha_edge = smoothstep(1.0, 1.0 - 2.0 / R, r2)
alpha = (alpha_edge * 255).astype(np.uint8)
alpha[~mask] = 0

rgba = np.dstack([lit.astype(np.uint8), alpha])
img = Image.fromarray(rgba, mode="RGBA")

canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
yy, xx = np.mgrid[0:SIZE, 0:SIZE]
dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / R
halo = np.clip(1 - (dist - 1.0) / 0.18, 0, 1) * (dist > 1.0)
halo = halo ** 1.5
gl = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
gl[..., 0] = 130
gl[..., 1] = 180
gl[..., 2] = 255
gl[..., 3] = (halo * 90).astype(np.uint8)
glow_layer = Image.fromarray(gl, mode="RGBA").filter(ImageFilter.GaussianBlur(10))

canvas = Image.alpha_composite(canvas, glow_layer)
canvas = Image.alpha_composite(canvas, img)

canvas.save("assets/earth-realistic.png")
print("saved assets/earth-realistic.png", canvas.size, "land_thresh", land_thresh)
