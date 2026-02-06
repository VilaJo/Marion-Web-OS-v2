#!/usr/bin/env python3
"""
Generate PWA icons for Marion Web OS using Pillow
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math

# Icon sizes needed for PWA
ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512]

# Splash screen sizes for iOS
SPLASH_SIZES = [
    (640, 1136),
    (750, 1334),
    (1242, 2208),
    (1125, 2436),
    (1284, 2778),
]

def create_gradient(size, color1, color2):
    """Create a radial gradient from color1 to color2"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    radius = size // 2
    
    for i in range(radius, 0, -1):
        # Interpolate colors
        t = i / radius
        r = int(color1[0] * t + color2[0] * (1 - t))
        g = int(color1[1] * t + color2[1] * (1 - t))
        b = int(color1[2] * t + color2[2] * (1 - t))
        
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, 255))
    
    return img

def create_icon(size, output_path):
    """Create a Marion icon at the specified size"""
    # Colors
    orange_start = (255, 126, 95)   # #FF7E5F
    orange_end = (254, 180, 123)    # #FEB47B
    
    # Create image with gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw gradient circle
    padding = max(2, size // 32)
    circle_size = size - padding * 2
    
    # Create circular gradient
    for i in range(circle_size // 2, 0, -1):
        t = i / (circle_size // 2)
        # Diagonal gradient
        r = int(orange_start[0] * t + orange_end[0] * (1 - t))
        g = int(orange_start[1] * t + orange_end[1] * (1 - t))
        b = int(orange_start[2] * t + orange_end[2] * (1 - t))
        
        cx, cy = size // 2, size // 2
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b, 255))
    
    # Add highlight
    highlight_size = circle_size // 3
    highlight_x = size // 2 - circle_size // 4
    highlight_y = size // 2 - circle_size // 4
    
    for i in range(highlight_size, 0, -1):
        alpha = int(40 * (i / highlight_size))
        draw.ellipse([
            highlight_x - i // 2, highlight_y - i // 2,
            highlight_x + i // 2, highlight_y + i // 2
        ], fill=(255, 255, 255, alpha))
    
    # Draw "M" letter
    try:
        # Try to use a serif font
        font_size = int(size * 0.55)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Times.ttc", font_size)
        except:
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Georgia.ttf", font_size)
            except:
                font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Draw M with shadow
    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - text_height // 8
    
    # Shadow
    shadow_offset = max(1, size // 64)
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=(0, 0, 0, 60))
    
    # Main text
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    
    img.save(output_path, 'PNG')
    print(f"  Created: {output_path.name}")

def create_splash(width, height, output_path):
    """Create a splash screen"""
    # Background gradient colors
    bg_start = (255, 228, 214)   # #FFE4D6
    bg_end = (255, 240, 245)     # #FFF0F5
    
    img = Image.new('RGBA', (width, height), bg_start)
    draw = ImageDraw.Draw(img)
    
    # Simple gradient background
    for y in range(height):
        t = y / height
        r = int(bg_start[0] * (1 - t) + bg_end[0] * t)
        g = int(bg_start[1] * (1 - t) + bg_end[1] * t)
        b = int(bg_start[2] * (1 - t) + bg_end[2] * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # Draw logo in center
    logo_size = min(width, height) // 4
    logo_x = (width - logo_size) // 2
    logo_y = (height - logo_size) // 2 - height // 10
    
    # Create logo
    orange_start = (255, 126, 95)
    orange_end = (254, 180, 123)
    
    for i in range(logo_size // 2, 0, -1):
        t = i / (logo_size // 2)
        r = int(orange_start[0] * t + orange_end[0] * (1 - t))
        g = int(orange_start[1] * t + orange_end[1] * (1 - t))
        b = int(orange_start[2] * t + orange_end[2] * (1 - t))
        
        cx = width // 2
        cy = height // 2 - height // 10
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(r, g, b))
    
    # Draw M
    try:
        font_size = logo_size // 2
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Times.ttc", font_size)
        except:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    tx = (width - text_width) // 2
    ty = height // 2 - height // 10 - text_height // 2
    draw.text((tx, ty), text, font=font, fill=(255, 255, 255))
    
    # Draw app name
    try:
        name_font_size = min(width, height) // 20
        try:
            name_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", name_font_size)
        except:
            name_font = ImageFont.load_default()
    except:
        name_font = ImageFont.load_default()
    
    name = "Marion Web OS"
    bbox = draw.textbbox((0, 0), name, font=name_font)
    name_width = bbox[2] - bbox[0]
    
    nx = (width - name_width) // 2
    ny = height // 2 + logo_size // 2
    draw.text((nx, ny), name, font=name_font, fill=(30, 41, 59))
    
    img.save(output_path, 'PNG')
    print(f"  Created: {output_path.name}")

def main():
    base_path = Path(__file__).parent / "public"
    icons_path = base_path / "icons"
    splash_path = base_path / "splash"
    
    icons_path.mkdir(parents=True, exist_ok=True)
    splash_path.mkdir(parents=True, exist_ok=True)
    
    print("🎨 Generating PWA icons for Marion Web OS...")
    print()
    
    # Generate icons
    print("📱 Creating app icons:")
    for size in ICON_SIZES:
        output_file = icons_path / f"icon-{size}x{size}.png"
        create_icon(size, output_file)
    
    print()
    
    # Generate splash screens
    print("🌅 Creating splash screens:")
    for width, height in SPLASH_SIZES:
        output_file = splash_path / f"splash-{width}x{height}.png"
        create_splash(width, height, output_file)
    
    print()
    print("✅ All PNG icons generated successfully!")

if __name__ == "__main__":
    main()
