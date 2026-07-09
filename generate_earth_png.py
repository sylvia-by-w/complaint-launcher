from PIL import Image, ImageDraw, ImageFilter, ImageOps
import math

out_path = 'assets/earth-realistic.png'
size = 1024
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Base sphere
center = (size // 2, size // 2)
radius = size // 2 - 30

# Soft blue/purple glow behind the sphere
for r in range(int(radius * 1.05), int(radius * 1.35), 12):
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((center[0]-r, center[1]-r, center[0]+r, center[1]+r), fill=(95, 170, 255, 20))
    img = Image.alpha_composite(img, glow)

# Base gradient sphere
base = Image.new('RGBA', (size, size), (0, 0, 0, 0))
base_draw = ImageDraw.Draw(base)
base_draw.ellipse((center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius), fill=(0, 0, 0, 0))

# Create a subtle gradient for the sphere
for y in range(size):
    for x in range(size):
        dx = x - center[0]
        dy = y - center[1]
        if dx*dx + dy*dy <= radius*radius:
            # Normalized position
            nx = dx / radius
            ny = dy / radius
            dist = math.sqrt(nx*nx + ny*ny)
            # Base color with light from upper-left
            r = int(20 + 90 * (0.65 + 0.35 * max(0, 1 - dist)))
            g = int(70 + 105 * (0.65 + 0.35 * max(0, 1 - dist)))
            b = int(140 + 70 * (0.6 + 0.4 * max(0, 1 - dist)))
            # Add a slight blue tint and ocean/land variation
            if 0.55 + 0.2 * math.sin((x + y) * 0.015) > 0.55:
                r = int(r * 0.95)
                g = int(g * 1.0)
                b = int(b * 1.08)
            else:
                r = int(r * 1.05)
                g = int(g * 1.02)
                b = int(b * 0.95)
            # Add land masses
            land = (math.sin((x - center[0]) * 0.008 + 0.7) + math.cos((y - center[1]) * 0.009 - 0.3) + 1.1)
            if land > 0.65:
                r = int(r + 20)
                g = int(g + 30)
                b = int(b + 15)
            # Shadow on the right/lower side
            if dx > 0 and dy > 0:
                r = int(r * 0.92)
                g = int(g * 0.94)
                b = int(b * 0.98)
            base.putpixel((x, y), (r, g, b, 255))

# Add subtle cloud bands
clouds = Image.new('RGBA', (size, size), (0, 0, 0, 0))
cdraw = ImageDraw.Draw(clouds)
for i in range(6):
    cx = size * (0.15 + 0.15 * i)
    cy = size * (0.25 + 0.12 * (i % 3))
    radius_x = size * (0.08 + 0.03 * (i % 2))
    radius_y = size * (0.04 + 0.02 * (i % 3))
    cdraw.ellipse((cx-radius_x, cy-radius_y, cx+radius_x, cy+radius_y), fill=(255, 255, 255, 35))

img = Image.alpha_composite(base, clouds)

# Add a thin atmosphere highlight
atmos = Image.new('RGBA', (size, size), (0, 0, 0, 0))
atdraw = ImageDraw.Draw(atmos)
atdraw.ellipse((center[0]-radius-8, center[1]-radius-8, center[0]+radius+8, center[1]+radius+8), outline=(180, 220, 255, 35), width=8)
img = Image.alpha_composite(img, atmos)

img.save(out_path)
print('saved', out_path)
