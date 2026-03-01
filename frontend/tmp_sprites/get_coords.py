import os
from PIL import Image

imgPath = "/Users/stormix/.gemini/antigravity/brain/ef62d0fb-eb83-4e30-b23f-239ba4731952/media__1772332526791.jpg"

if not os.path.exists(imgPath):
    print("File not found")
else:
    img = Image.open(imgPath)
    print(f"Size: {img.size}")
