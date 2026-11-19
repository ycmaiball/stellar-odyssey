from PIL import Image, ImageOps, ImageEnhance, ImageDraw
import os

root = os.path.dirname(os.path.abspath(__file__)) + os.sep + 'textures'

# Cloud alpha map: the source is a bright cloud field on black.
clouds = Image.open(os.path.join(root, 'earth_clouds_sss.jpg')).convert('L')
clouds = ImageOps.autocontrast(clouds, cutoff=2)
clouds = ImageEnhance.Contrast(clouds).enhance(1.28)
clouds = clouds.point(lambda v: min(255, int(v * 1.04)))
clouds.save(os.path.join(root, 'earth_clouds_alpha.png'), optimize=True)

# Browser-friendly normal map.
normal = Image.open(os.path.join(root, 'earth_normal_sss.tif')).convert('RGB')
normal.save(os.path.join(root, 'earth_normal.jpg'), quality=94, optimize=True)

# Contact sheet for visual review.
files = [
    'earth_day_sss.jpg', 'earth_night_sss.jpg', 'earth_clouds_sss.jpg',
    'mercury_sss.jpg', 'venus_sss.jpg', 'mars_sss.jpg',
    'jupiter_sss.jpg', 'saturn_sss.jpg', 'uranus_sss.jpg',
    'neptune_sss.jpg', 'moon_sss.jpg', 'sun_sss.jpg',
]
thumbs = []
for f in files:
    im = Image.open(os.path.join(root, f)).convert('RGB')
    im.thumbnail((320, 160))
    thumbs.append((f, im))

sheet = Image.new('RGB', (320 * 3, 190 * 4), (8, 10, 16))
draw = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(thumbs):
    x = (i % 3) * 320
    y = (i // 3) * 190
    sheet.paste(im, (x, y))
    draw.text((x + 6, y + 164), name, fill=(200, 230, 240))

sheet.save(os.path.join(os.path.dirname(root), 'contact-sheet.jpg'), quality=90)
print('cloud alpha', os.path.getsize(os.path.join(root, 'earth_clouds_alpha.png')))
print('normal', os.path.getsize(os.path.join(root, 'earth_normal.jpg')))