"""Turn any photo into an ArtiVerse product picture (800x1000, 4:5), without cropping the product.

Usage:   python tools/prepare_photo.py my-photo.jpg  maroon-gold-kanjivaram-bridal-saree
Result:  static/img/products/maroon-gold-kanjivaram-bridal-saree.jpg   (replaces the existing picture)
Needs:   Pillow (already in requirements.txt)
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

W, H = 800, 1000
src, name = Path(sys.argv[1]), sys.argv[2].removesuffix(".jpg")
im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
if 0.72 <= im.width / im.height <= 0.88:
    out = ImageOps.fit(im, (W, H), Image.LANCZOS)
else:  # keep the whole photo and pad with a soft blurred copy of itself
    bg = ImageEnhance.Brightness(ImageOps.fit(im, (W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(34))).enhance(0.9)
    s = min(W / im.width, H / im.height)
    fg = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = bg.copy()
    out.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
dest = Path(__file__).resolve().parent.parent / "static" / "img" / "products" / f"{name}.jpg"
out.save(dest, "JPEG", quality=84, optimize=True, progressive=True)
print("saved", dest)
