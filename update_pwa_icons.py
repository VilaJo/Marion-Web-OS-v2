#!/usr/bin/env python3
"""
Script to generate PWA icons from the original Marion logo
"""
from PIL import Image
import os

# Paths
logo_path = "public/logo-eonora-appicon.png"
icons_dir = "public/icons"

# Icon sizes needed for PWA
sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512]

def generate_icons():
    # Load the original logo
    if not os.path.exists(logo_path):
        print(f"❌ Logo not found at {logo_path}")
        return
    
    original = Image.open(logo_path).convert('RGBA')
    print(f"✅ Loaded original logo: {original.size}")
    
    # Ensure icons directory exists
    os.makedirs(icons_dir, exist_ok=True)
    
    for size in sizes:
        # Create a square canvas with transparent background
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        
        # Calculate the size to make the logo fill 50% of the icon
        # This gives a good margin around the edges so the full logo is visible
        target_size = int(size * 0.50)
        
        # Resize the logo maintaining aspect ratio
        logo_copy = original.copy()
        
        # Calculate scaling to fit in target_size while maintaining aspect ratio
        width_ratio = target_size / logo_copy.width
        height_ratio = target_size / logo_copy.height
        ratio = min(width_ratio, height_ratio)
        
        new_width = int(logo_copy.width * ratio)
        new_height = int(logo_copy.height * ratio)
        
        # Resize with high quality
        resized = logo_copy.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Center the resized logo on the canvas
        x = (size - new_width) // 2
        y = (size - new_height) // 2
        
        # Paste the logo onto the canvas
        canvas.paste(resized, (x, y), resized)
        
        # Save
        output_path = os.path.join(icons_dir, f"icon-{size}x{size}.png")
        canvas.save(output_path, "PNG", optimize=True)
        print(f"✅ Generated {output_path} ({new_width}x{new_height} logo in {size}x{size} canvas)")
    
    print("\n✅ All PWA icons generated successfully!")

if __name__ == "__main__":
    generate_icons()
