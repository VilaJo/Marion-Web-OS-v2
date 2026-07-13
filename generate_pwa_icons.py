#!/usr/bin/env python3
"""
Generate PWA icons for Eonora Tech OS
Creates icons in various sizes from an SVG template
"""

import os
from pathlib import Path

# Icon sizes needed for PWA
ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512]

# Splash screen sizes for iOS
SPLASH_SIZES = [
    (640, 1136),   # iPhone 5/SE
    (750, 1334),   # iPhone 6/7/8
    (1242, 2208),  # iPhone 6/7/8 Plus
    (1125, 2436),  # iPhone X/XS
    (1284, 2778),  # iPhone 12/13 Pro Max
]

# SVG template for the Marion icon
ICON_SVG = '''<svg width="{size}" height="{size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF7E5F"/>
      <stop offset="100%" style="stop-color:#FEB47B"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#FF7E5F" flood-opacity="0.4"/>
    </filter>
  </defs>
  <circle cx="256" cy="256" r="240" fill="url(#grad)" filter="url(#shadow)"/>
  <ellipse cx="180" cy="180" rx="80" ry="60" fill="rgba(255,255,255,0.2)" transform="rotate(-30 180 180)"/>
  <text x="256" y="320" font-family="Georgia, serif" font-size="280" font-style="italic" fill="white" text-anchor="middle" filter="url(#shadow)">M</text>
</svg>'''

# SVG for splash screens
SPLASH_SVG = '''<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFE4D6"/>
      <stop offset="50%" style="stop-color:#FFF8F5"/>
      <stop offset="100%" style="stop-color:#FFF0F5"/>
    </linearGradient>
    <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF7E5F"/>
      <stop offset="100%" style="stop-color:#FEB47B"/>
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#bgGrad)"/>
  <g transform="translate({cx}, {cy})">
    <circle cx="0" cy="0" r="80" fill="url(#logoGrad)"/>
    <text x="0" y="28" font-family="Georgia, serif" font-size="90" font-style="italic" fill="white" text-anchor="middle">M</text>
  </g>
  <text x="{cx}" y="{texty}" font-family="Montserrat, sans-serif" font-size="32" font-weight="600" fill="#1e293b" text-anchor="middle">Eonora Tech OS</text>
</svg>'''

def create_icon_svg(size: int, output_path: Path):
    """Create an SVG icon at the specified size"""
    svg_content = ICON_SVG.format(size=size)
    output_path.write_text(svg_content)
    print(f"  Created: {output_path.name}")

def create_splash_svg(width: int, height: int, output_path: Path):
    """Create a splash screen SVG"""
    cx = width // 2
    cy = height // 2 - 50
    texty = cy + 150
    svg_content = SPLASH_SVG.format(width=width, height=height, cx=cx, cy=cy, texty=texty)
    output_path.write_text(svg_content)
    print(f"  Created: {output_path.name}")

def main():
    base_path = Path(__file__).parent / "public"
    icons_path = base_path / "icons"
    splash_path = base_path / "splash"
    
    icons_path.mkdir(parents=True, exist_ok=True)
    splash_path.mkdir(parents=True, exist_ok=True)
    
    print("🎨 Generating PWA icons for Eonora Tech OS...")
    print()
    
    # Generate icons
    print("📱 Creating app icons:")
    for size in ICON_SIZES:
        output_file = icons_path / f"icon-{size}x{size}.svg"
        create_icon_svg(size, output_file)
    
    print()
    
    # Generate splash screens
    print("🌅 Creating splash screens:")
    for width, height in SPLASH_SIZES:
        output_file = splash_path / f"splash-{width}x{height}.svg"
        create_splash_svg(width, height, output_file)
    
    print()
    print("✅ Done! SVG icons created successfully.")
    print()
    print("📝 Note: For PNG icons, you can convert these SVGs using:")
    print("   - Online: svgtopng.com or cloudconvert.com")
    print("   - CLI: inkscape, rsvg-convert, or ImageMagick")
    print("   - Python: pip install cairosvg, then cairosvg.svg2png()")
    
    # Try to convert to PNG if cairosvg is available
    try:
        import cairosvg
        print()
        print("🔄 Converting SVGs to PNGs...")
        
        for size in ICON_SIZES:
            svg_file = icons_path / f"icon-{size}x{size}.svg"
            png_file = icons_path / f"icon-{size}x{size}.png"
            cairosvg.svg2png(url=str(svg_file), write_to=str(png_file), output_width=size, output_height=size)
            svg_file.unlink()  # Remove SVG after conversion
            print(f"  Converted: {png_file.name}")
        
        for width, height in SPLASH_SIZES:
            svg_file = splash_path / f"splash-{width}x{height}.svg"
            png_file = splash_path / f"splash-{width}x{height}.png"
            cairosvg.svg2png(url=str(svg_file), write_to=str(png_file), output_width=width, output_height=height)
            svg_file.unlink()
            print(f"  Converted: {png_file.name}")
        
        print()
        print("✅ PNG conversion complete!")
        
    except ImportError:
        print()
        print("ℹ️  cairosvg not installed. To generate PNG files:")
        print("   pip install cairosvg")
        print("   python generate_pwa_icons.py")

if __name__ == "__main__":
    main()
