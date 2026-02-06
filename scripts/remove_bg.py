from PIL import Image
import os
import sys

def remove_black_background(image_path):
    print(f"Processing {image_path}...")
    try:
        img = Image.open(image_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # item is (r, g, b, a)
            # Calculate brightness/intensity
            # Simple heuristic: Alpha is based on the max brightness of channels
            # This preserves glow. If it's pure black (0,0,0), alpha is 0.
            # If it's bright neon, alpha is high.
            
            r, g, b, a = item
            
            # "Screen" logic: The opacity of a light-emitting pixel on black is determined by its brightness.
            # We want the pixel to look the same on black background after compositing.
            # Source: (R, G, B) on Black. 
            # Target: (R', G', B', Alpha) such that R' * Alpha = R.
            # A good approximation for neon is max(r,g,b).
            
            max_val = max(r, g, b)
            
            if max_val == 0:
                newData.append((0, 0, 0, 0)) # Fully transparent
            else:
                # Normalize color channels by alpha to "unmultiply"
                # If we just keep r,g,b and set alpha=max_val, it might look too dark on light backgrounds.
                # But for standard "remove black bg", keeping RGB and setting A=max_val is a solid "Add" emulation.
                
                # To make it look good on white too, we might want slightly different logic, 
                # but "Glow" is fundamentally additive.
                # Let's try aggressive removal: if close to black, make transparent.
                
                # Approach 2: Smooth transparency
                # alpha = max_val
                # We boost alpha a bit to make the solid parts more solid
                
                alpha = max_val
                
                # Optional: Threshold to remove absolute noise
                if alpha < 10:
                    alpha = 0
                
                newData.append((r, g, b, alpha))
        
        img.putdata(newData)
        img.save(image_path, "PNG")
        print(f"Saved {image_path}")
        
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

files = [
    "public/logo-new.png",
    "public/icon-create.png",
    "public/icon-fund.png",
    "public/icon-generate.png",
    "public/icon-release.png"
]

base_dir = "/Users/fabiomaulana/.gemini/antigravity/scratch/base-campaign-vault-agent"

for f in files:
    path = os.path.join(base_dir, f)
    if os.path.exists(path):
        remove_black_background(path)
    else:
        print(f"File not found: {path}")
