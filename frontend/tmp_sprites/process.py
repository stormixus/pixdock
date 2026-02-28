from PIL import Image, ImageDraw
import os

src_dir = '/Users/stormix/.gemini/antigravity/brain/ef62d0fb-eb83-4e30-b23f-239ba4731952/'
dest_dir = '/Volumes/MacExt/Projects/pixdock/frontend/static/assets/'
os.makedirs(dest_dir, exist_ok=True)

images = [
    {'name': 'agent_whale.png', 'src': 'pixel_whale_sprite_1772295795880.png', 'scale': 0.1},
    {'name': 'node_desk.png', 'src': 'pixel_server_desk_1772295817760.png', 'scale': 0.15},
    {'name': 'bookshelf.png', 'src': 'pixel_bookshelf_1772295832176.png', 'scale': 0.15}
]

def is_white(rgba):
    return rgba[0] > 240 and rgba[1] > 240 and rgba[2] > 240

for img_info in images:
    print(f"Processing {img_info['name']}...")
    img_path = os.path.join(src_dir, img_info['src'])
    
    img = Image.open(img_path).convert("RGBA")
    
    # Floodfill from (0,0) with transparent color
    ImageDraw.floodfill(img, (0, 0), (0, 0, 0, 0), thresh=20)
    # Also floodfill from other corners to be safe
    w, h = img.size
    ImageDraw.floodfill(img, (w-1, 0), (0, 0, 0, 0), thresh=20)
    ImageDraw.floodfill(img, (0, h-1), (0, 0, 0, 0), thresh=20)
    ImageDraw.floodfill(img, (w-1, h-1), (0, 0, 0, 0), thresh=20)

    # Autocrop transparent regions
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Resize nearest neighbor
    new_w = int(img.size[0] * img_info['scale'])
    new_h = int(img.size[1] * img_info['scale'])
    # In Pillow >= 10, ANTIALIAS is removed, use NEAREST
    img = img.resize((new_w, new_h), resample=Image.Resampling.NEAREST)

    out_path = os.path.join(dest_dir, img_info['name'])
    img.save(out_path)
    print(f"Saved {out_path}")
