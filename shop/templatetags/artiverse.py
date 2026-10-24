"""Template helpers for product photos.

Every product stores an image path such as ``img/products/my-saree.jpg``. The ``photo`` filter shows that picture
(or the same name with a .jpeg / .webp / .png extension) and falls back to a neutral placeholder if the file is missing.
Replace a picture by dropping a new file with the same name into ``static/img/products/`` - no database change needed.
"""
from django import template
from django.conf import settings
from django.contrib.staticfiles import finders
from django.templatetags.static import static

register = template.Library()
PHOTO_EXTENSIONS = ("jpg", "jpeg", "webp", "png")
_cache = {}


def _first_existing(base, extensions):
    for ext in extensions:
        path = f"{base}.{ext}"
        if finders.find(path):
            return path
    return None


@register.filter
def photo(path):
    """{{ product.image|photo }} -> URL of the product photo (jpg/jpeg/webp/png), or a neutral placeholder if it is missing."""
    if not path:
        return static("img/placeholder.svg")
    if settings.DEBUG or path not in _cache:
        base = path.rsplit(".", 1)[0]
        found = _first_existing(base, PHOTO_EXTENSIONS)
        if not found and finders.find(path):
            found = path
        _cache[path] = found or "img/placeholder.svg"
    return static(_cache[path])


@register.simple_tag
def banner(name):
    """{% banner 'hero-women' as url %} -> URL of static/img/banners/<name>.jpg|webp|png or ''."""
    found = _first_existing(f"img/banners/{name}", PHOTO_EXTENSIONS)
    return static(found) if found else ""
