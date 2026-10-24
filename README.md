# Simple E-commerce Store – CodeAlpha

A women-only fashion store built with **Django + SQLite**, plain HTML5, CSS3 and vanilla JavaScript (no frameworks).

## Run it (VS Code)

```bash
python -m venv venv
venv\Scripts\activate            # Windows   (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed            # loads the 90 products (safe to repeat)
python manage.py createsuperuser # optional admin login
python manage.py runserver
```
Open http://127.0.0.1:8000/ (admin: /admin/). Run the tests with `python manage.py test`.
The bundled `db.sqlite3` is already migrated and seeded, so `runserver` works straight away.

## What's new in this version
- **Men's section removed completely** – menu, filters, categories and products. The shop is women-only.
- **90 new products** from your photos, each with its own name, price, overview and highlights written from what the photo shows.
- **Menus**: `Sarees ▾`, `Clothing ▾`, `Accessories ▾` open drop-downs, and clicking Clothing / Accessories opens a page showing every option:
  - Sarees → South Indian, Banarasi, Fancy, Party Wear, Daily Use
  - Clothing → Sarees, Bodycon, Traditional, Kurtis, Western, Tops & Tunics, Jeans
  - Accessories → Jewellery (Necklaces, Anklets, Bracelets, Earrings, Rings, Bajubandh), Chashmas, Watches, Perfumes, Heels, Purses & Bags, Beauty & Makeup, Caps & Hats
- **Royal redesign**: burgundy, antique gold and ivory palette, Cinzel / Cormorant Garamond / Great Vibes fonts, arched photo frames, gold ornaments, new hero, new login & register look. Colours are variables at the top of `static/css/style.css`.

## Where things are
```
shop/catalog.py            all categories, products, prices, overviews (edit here, then: python manage.py seed --refresh)
shop/context_processors.py menu structure (MENU_COLUMNS controls the drop-down columns)
templates/base.html        header, menu, footer     templates/shop/home.html  homepage
static/css/style.css       all styling              static/img/products/      product photos (see PHOTO_GUIDE.md)
```
Photos & fonts: fonts load from Google Fonts (needs internet; sensible fallbacks otherwise).
Shipping: free above ₹1999 else ₹99 (`stylehub/settings.py`). `DEBUG=True` and `SECRET_KEY` are for local use only.
The prices, sizes, stock numbers and material details are sample values – edit them to match your real products.
