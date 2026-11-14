from PIL import Image
import os

source_icon = r"d:\projects\AI-Data-Analyst\public\pwa-512x512.png"
img = Image.open(source_icon)

res_dir = r"d:\projects\AI-Data-Analyst\android\app\src\main\res"

sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

for folder, size in sizes.items():
    target_dir = os.path.join(res_dir, folder)
    if os.path.exists(target_dir):
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(target_dir, 'ic_launcher.png'))
        resized.save(os.path.join(target_dir, 'ic_launcher_round.png'))
        resized.save(os.path.join(target_dir, 'ic_launcher_foreground.png'))
        print(f"Generated icons for {folder} ({size}x{size})")

print("Icons generated successfully!")
