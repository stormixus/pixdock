from PIL import Image
import os
import sys

files = ['brick_wall.png']
base = '/Volumes/MacExt/Projects/pixdock/frontend/static/assets/'

def is_bg(r, g, b, a):
    if a == 0: return False
    if abs(r-g) < 15 and abs(g-b) < 15 and r > 180:
        return True
    return False

for f in files:
    path = os.path.join(base, f)
    if not os.path.exists(path): continue
    
    img = Image.open(path).convert('RGBA')
    width, height = img.size
    pixels = img.load()
    
    visited = set()
    queue = []
    
    for x in range(width):
        if is_bg(*pixels[x, 0]): queue.append((x, 0))
        if is_bg(*pixels[x, height-1]): queue.append((x, height-1))
    for y in range(height):
        if is_bg(*pixels[0, y]): queue.append((0, y))
        if is_bg(*pixels[width-1, y]): queue.append((width-1, y))

    for qx, qy in queue:
        visited.add((qx, qy))
        
    while queue:
        x, y = queue.pop(0)
        pixels[x, y] = (0, 0, 0, 0)
        
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                if (nx, ny) not in visited:
                    visited.add((nx, ny))
                    if is_bg(*pixels[nx, ny]):
                        queue.append((nx, ny))

    img.save(path)
    print(f"Cleaned {f}")
