const { Jimp, intToRGBA, rgbaToInt } = require('jimp');
const fs = require('fs');
const path = require('path');

const srcDir = '/Users/stormix/.gemini/antigravity/brain/ef62d0fb-eb83-4e30-b23f-239ba4731952/';
const destDir = '/Volumes/MacExt/Projects/pixdock/frontend/static/assets/';

fs.mkdirSync(destDir, { recursive: true });

const images = [
    { name: 'agent_whale.png', src: 'pixel_whale_sprite_1772295795880.png', scale: 0.05 },
    { name: 'node_desk.png', src: 'pixel_server_desk_1772295817760.png', scale: 0.15 },
    { name: 'bookshelf.png', src: 'pixel_bookshelf_1772295832176.png', scale: 0.15 }
];

async function processImage({name, src, scale}) {
    console.log(`Processing ${name}...`);
    try {
        const imagePath = path.join(srcDir, src);
        const image = await Jimp.read(imagePath);
        
        // Simple Flood Fill from corners for white background
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const targetColor = rgbaToInt(255, 255, 255, 255);
        const transparent = rgbaToInt(0, 0, 0, 0);

        // A simple tolerance check
        const isWhite = (c) => {
            const rgba = intToRGBA(c);
            return rgba.r > 240 && rgba.g > 240 && rgba.b > 240 && rgba.a > 200;
        };

        let stack = [
            {x: 0, y: 0},
            {x: width - 1, y: 0},
            {x: 0, y: height - 1},
            {x: width - 1, y: height - 1}
        ];
        
        let visited = new Set();

        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            
            const color = image.getPixelColor(x, y);
            if (isWhite(color)) {
                image.setPixelColor(transparent, x, y);
                visited.add(key);
                
                stack.push({x: x + 1, y: y});
                stack.push({x: x - 1, y: y});
                stack.push({x: x, y: y + 1});
                stack.push({x: x, y: y - 1});
            }
        }

        // Crop transparent regions
        image.autocrop({ cropOnlyFrames: false, tolerance: 0.01 });

        // Calculate new dimensions
        const newWidth = Math.floor(image.bitmap.width * scale);
        
        // Resize nearest neighbor to keep pixel art crisp
        image.resize(newWidth, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR);

        const outPath = path.join(destDir, name);
        await image.write(outPath);
        console.log(`Saved ${outPath}`);
    } catch (err) {
        console.error(`Error processing ${name}:`, err);
    }
}

async function run() {
    for (const img of images) {
        await processImage(img);
    }
}

run();
