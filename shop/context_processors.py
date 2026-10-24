from django.conf import settings
from django.db.models import Count, Sum

from .models import CartItem, Category, Product, Profile, Wishlist

SECTIONS = {
    "clothing": {"name": "Clothing", "tagline": "Sarees, gowns, lehengas, kurtis, tops & denim",
                 "blurb": "From South Indian silks to couture gowns - dress for every celebration."},
    "accessories": {"name": "Accessories", "tagline": "Jewellery, chashmas, watches, perfumes, heels & bags",
                    "blurb": "The finishing touches that make an outfit unforgettable."},
}

# How the drop-down menu groups things. Anything not listed (e.g. a category you add in the admin) lands in "More".
MENU_COLUMNS = {
    "clothing": [("Sarees", ["sarees"]), ("Dresses & Co-ords", ["bodycon", "traditional", "western"]),
                 ("Everyday Wear", ["kurtis", "tops-tunics", "jeans"])],
    "accessories": [("Jewellery", ["jewellery"]), ("Eyewear & Time", ["chashmas", "watches"]),
                    ("Fragrance & Beauty", ["perfumes", "beauty"]), ("Footwear & Bags", ["heels", "purses-bags", "caps"])],
}


def get_tree(request):
    """All categories as a tree, with product counts. Cached on the request so it costs one set of queries per page."""
    cached = getattr(request, "_av_tree", None)
    if cached is not None:
        return cached
    cats = list(Category.objects.all())
    counts = dict(Product.objects.filter(is_active=True).values_list("category_id").annotate(n=Count("id")))
    by_id = {c.pk: c for c in cats}
    for c in cats:
        c.kids = []
        c.count = counts.get(c.pk, 0)
    for c in cats:
        if c.parent_id and c.parent_id in by_id:
            by_id[c.parent_id].kids.append(c)
    for c in cats:
        c.total = c.count + sum(k.count for k in c.kids)
    top = [c for c in cats if not c.parent_id or c.parent_id not in by_id]
    tree = {"all": cats, "top": top, "by_slug": {c.slug: c for c in cats}}
    request._av_tree = tree
    return tree


def _menu(tree):
    groups = []
    for key, meta in SECTIONS.items():
        tops = [c for c in tree["top"] if c.group == key]
        placed, columns = set(), []
        for title, slugs in MENU_COLUMNS[key]:
            items = [tree["by_slug"][s] for s in slugs if s in tree["by_slug"]]
            placed.update(c.slug for c in items)
            if items:
                head = items[0] if len(items) == 1 and items[0].kids else None
                links = head.kids if head else items
                columns.append({"title": title, "head": head, "links": links})
        extra = [c for c in tops if c.slug not in placed]
        if extra:
            columns.append({"title": "More", "head": None, "links": extra})
        groups.append({"key": key, "label": meta["name"], "tagline": meta["tagline"], "columns": columns, "top": tops})
    sarees = tree["by_slug"].get("sarees")
    return groups, sarees


def store(request):
    tree = get_tree(request)
    nav_groups, nav_sarees = _menu(tree)
    ctx = {
        "STORE_NAME": settings.STORE_NAME,
        "nav_groups": nav_groups,
        "nav_sarees": nav_sarees,
        "nav_top": tree["top"],
        "cart_count": 0,
        "wishlist_ids": set(),
        "avatar_url": "",
        "FREE_SHIPPING_ABOVE": settings.FREE_SHIPPING_ABOVE,
    }
    if request.user.is_authenticated:
        ctx["cart_count"] = CartItem.objects.filter(user=request.user).aggregate(n=Sum("quantity"))["n"] or 0
        ctx["wishlist_ids"] = set(Wishlist.objects.filter(user=request.user).values_list("product_id", flat=True))
        prof = Profile.objects.filter(user=request.user).exclude(photo="").first()
        ctx["avatar_url"] = prof.photo.url if prof else ""
    return ctx
