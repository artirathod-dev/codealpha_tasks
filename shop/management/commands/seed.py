from django.core.management.base import BaseCommand
from django.utils.text import slugify

from shop.catalog import CARE, CATEGORIES, PRODUCTS
from shop.models import Category, Product


def image_path(name):
    return f"img/products/{slugify(name)}.jpg"


class Command(BaseCommand):
    help = ("Load the ArtiVerse women's catalogue (safe to run more than once). "
            "Also removes the old demo products (men's wear, belts, formal pants...). "
            "Use --refresh to overwrite names, prices and descriptions of existing products with the catalog.py values.")

    def add_arguments(self, parser):
        parser.add_argument("--refresh", action="store_true",
                            help="Overwrite text, prices and stock of existing catalogue products.")

    def handle(self, *args, **options):
        refresh = options["refresh"]

        # ---- 1. retire the old demo catalogue (placeholder drawings, men's wear...) ----
        old = Product.objects.filter(image__endswith=".svg")
        removed = old.count()
        old.delete()

        # ---- 2. categories (parents first, so children can point at them) ----
        sizes_by_cat = {}
        by_slug = {}
        for pos, (slug, name, group, parent, tagline, sizes) in enumerate(CATEGORIES, start=1):
            sizes_by_cat[slug] = sizes
            cat, _ = Category.objects.update_or_create(slug=slug, defaults={
                "name": name, "group": group, "tagline": tagline, "position": pos, "icon": "",
                "parent": by_slug.get(parent) if parent else None})
            by_slug[slug] = cat

        # ---- 3. products ----
        created = 0
        for cat_slug, items in PRODUCTS.items():
            cat = by_slug[cat_slug]
            for item in items:
                ref, name, price, mrp, short, overview, highlights, stock, featured, *rest = item
                opts = rest[0] if rest else {}
                slug = slugify(name)
                defaults = {
                    "name": name, "category": cat, "price": price, "mrp": mrp,
                    "short_description": short,
                    "description": f"{overview}\n\n{CARE[cat_slug]}",
                    "highlights": "\n".join(highlights),
                    "image": image_path(name), "stock": stock,
                    "sizes": opts.get("sizes", sizes_by_cat[cat_slug]), "featured": featured, "is_active": True}
                if refresh:
                    _, was_new = Product.objects.update_or_create(slug=slug, defaults=defaults)
                else:
                    _, was_new = Product.objects.get_or_create(slug=slug, defaults=defaults)
                created += was_new

        # ---- 4. cover picture for every category (first product inside it) ----
        for slug, cat in by_slug.items():
            ids = [cat.pk, *cat.children.values_list("pk", flat=True)]
            first = Product.objects.filter(category_id__in=ids, is_active=True).order_by("-featured", "id").first()
            if first:
                Category.objects.filter(pk=cat.pk).update(image=first.image)

        # ---- 5. drop old categories that are no longer part of the catalogue and are empty ----
        for cat in Category.objects.exclude(slug__in=by_slug.keys()):
            if not cat.products.exists() and not cat.children.exists():
                cat.delete()

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue ready: {Category.objects.count()} categories, {Product.objects.count()} products "
            f"({created} new, {removed} old demo products removed)."))
