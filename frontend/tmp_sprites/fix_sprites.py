#!/usr/bin/env python3
"""Fix sprite transparency and create worker sprite if needed."""
from PIL import Image, ImageDraw
import os

base = '/Volumes/MacExt/Projects/pixdock/frontend/static/assets/'

def clean_bg_to_transparent(path, threshold=200):
    """Make light gray/white background transparent."""
    if not os.path.exists(path):
        return
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    def is_bg(r, g, b, a):
        if a == 0:
            return False
        if r > threshold and g > threshold and b > threshold:
            return True
        # Light gray
        if abs(r - g) < 20 and abs(g - b) < 20 and r > 180:
            return True
        return False

    for y in range(h):
        for x in range(w):
            if is_bg(*pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)

    # Alternative: floodfill from corners
    ImageDraw.floodfill(img, (0, 0), (0, 0, 0, 0), thresh=50)
    ImageDraw.floodfill(img, (w-1, 0), (0, 0, 0, 0), thresh=50)
    ImageDraw.floodfill(img, (0, h-1), (0, 0, 0, 0), thresh=50)
    ImageDraw.floodfill(img, (w-1, h-1), (0, 0, 0, 0), thresh=50)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path)
    print(f"Cleaned {path}")

def create_worker_sprite():
    """Create minimal pixel art worker sprite with transparency."""
    w, h = 32, 48
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = img.load()

    # Simple pixel person: head, body (blue vest), legs, holding doc
    # Colors
    skin = (255, 220, 180, 255)
    hair = (80, 50, 30, 255)
    vest = (40, 80, 140, 255)
    pants = (60, 60, 70, 255)
    boot = (100, 70, 50, 255)
    doc = (255, 255, 250, 255)

    # Legs (y 32-46)
    for y in range(32, 47):
        pixels[12, y] = pants
        pixels[13, y] = pants
        pixels[18, y] = pants
        pixels[19, y] = pants
    pixels[12, 46] = boot
    pixels[13, 46] = boot
    pixels[18, 46] = boot
    pixels[19, 46] = boot

    # Body/vest (y 16-31)
    for y in range(16, 32):
        for x in range(11, 20):
            pixels[x, y] = vest
    # IT text hint
    pixels[13, 20] = (255, 255, 255, 255)
    pixels[16, 20] = (255, 255, 255, 255)

    # Head (y 6-15)
    for y in range(8, 16):
        for x in range(12, 18):
            pixels[x, y] = skin
    # Hair
    for x in range(12, 18):
        pixels[x, 8] = hair
    # Glasses
    pixels[13, 11] = (30, 30, 30, 255)
    pixels[16, 11] = (30, 30, 30, 255)

    # Document in hand
    for y in range(18, 28):
        pixels[8, y] = doc
        pixels[9, y] = doc

    out = os.path.join(base, 'worker_sprite.png')
    img.save(out)
    print(f"Created {out}")

if __name__ == '__main__':
    # Use existing RGBA assets - they're fine
    # Create worker sprite
    create_worker_sprite()
