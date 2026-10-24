from decimal import Decimal

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import F, Q
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from .forms import CheckoutForm, ProfilePhotoForm, RegisterForm, ReviewForm
from .templatetags.artiverse import photo
from .context_processors import SECTIONS, get_tree
from .models import CartItem, Category, Order, OrderItem, Product, Profile, Review, Wishlist


# ---------- helpers ----------
def is_ajax(request):
    return request.headers.get("x-requested-with") == "XMLHttpRequest"


def ajax_login_required(view):
    """Like @login_required, but AJAX calls get a JSON 401 so the page can redirect nicely."""
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            nxt = request.POST.get("next") or request.path
            if not url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}):
                nxt = request.path
            login_url = f"{reverse('login')}?next={nxt}"
            if is_ajax(request):
                return JsonResponse({"ok": False, "login": login_url, "message": "Please log in first."}, status=401)
            return redirect(login_url)
        return view(request, *args, **kwargs)
    wrapper.__name__ = view.__name__
    return wrapper


def cart_totals(items):
    subtotal = sum((i.subtotal for i in items), Decimal("0"))
    shipping = Decimal("0") if (subtotal >= settings.FREE_SHIPPING_ABOVE or subtotal == 0) else Decimal(settings.SHIPPING_FEE)
    return subtotal, shipping, subtotal + shipping


def reply(request, ok, message, fallback="cart", **extra):
    """Return JSON for AJAX requests, otherwise flash a message and redirect."""
    if is_ajax(request):
        from django.db.models import Sum
        count = CartItem.objects.filter(user=request.user).aggregate(n=Sum("quantity"))["n"] or 0
        return JsonResponse({"ok": ok, "message": message, "cart_count": count, **extra}, status=200 if ok else 400)
    (messages.success if ok else messages.error)(request, message)
    target = request.POST.get("next") or request.META.get("HTTP_REFERER") or reverse(fallback)
    if not url_has_allowed_host_and_scheme(target, allowed_hosts={request.get_host()}):
        target = reverse(fallback)
    return redirect(target)


# ---------- browsing ----------
SHELF_BUCKETS = [  # (key shown on the homepage buttons, how to pick its products)
    ("sarees", lambda qs: qs.filter(category__parent__slug="sarees")),
    ("clothing", lambda qs: qs.filter(category__group="clothing").exclude(category__parent__slug="sarees")),
    ("jewellery", lambda qs: qs.filter(category__parent__slug="jewellery")),
    ("accessories", lambda qs: qs.filter(category__group="accessories").exclude(category__parent__slug="jewellery")),
]


def _shelf(products, per_bucket=4):
    """A few products from each homepage bucket, so every button on the homepage shelf has items."""
    picked = []
    for key, pick in SHELF_BUCKETS:
        for p in pick(products).select_related("category", "category__parent").order_by("-featured", "-id")[:per_bucket]:
            p.family = key
            picked.append(p)
    return picked


def home(request):
    products = Product.objects.filter(is_active=True).select_related("category")
    tree = get_tree(request)
    by_slug = tree["by_slug"]
    sarees = by_slug.get("sarees")
    jewellery = by_slug.get("jewellery")
    return render(request, "shop/home.html", {
        "nav_active": "home",
        "shelf": _shelf(products),
        "saree_types": sarees.kids if sarees else [],
        "clothing_tiles": [c for c in tree["top"] if c.group == "clothing" and c.slug != "sarees"],
        "jewellery_tiles": jewellery.kids if jewellery else [],
        "accessory_tiles": [c for c in tree["top"] if c.group == "accessories" and c.slug != "jewellery"],
        "deals": [p for p in products.order_by("-id")[:120] if p.discount_percent >= 45][:4],
        "new_arrivals": products.order_by("-created", "-id")[:4],
    })


def collection(request, group):
    """Landing page for Clothing / Accessories: shows every option (e.g. Jewellery > Necklace, Anklet, Ring ...)."""
    if group not in SECTIONS:
        raise Http404
    tree = get_tree(request)
    tops = [c for c in tree["top"] if c.group == group]
    families = [c for c in tops if c.kids]
    singles = [c for c in tops if not c.kids]
    featured = Product.objects.filter(is_active=True, category__group=group).select_related("category")\
        .order_by("-featured", "-id")[:8]
    return render(request, "shop/collection.html", {
        "nav_active": group, "group": group, "section": SECTIONS[group], "families": families, "singles": singles,
        "featured": featured, "total": sum(c.total for c in tops),
    })


def product_list(request):
    qs = Product.objects.filter(is_active=True).select_related("category", "category__parent")
    q = request.GET.get("q", "").strip()
    cat = request.GET.get("category", "")
    group = request.GET.get("group", "")
    sort = request.GET.get("sort", "new")
    pmin, pmax = request.GET.get("min", ""), request.GET.get("max", "")

    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(short_description__icontains=q) | Q(description__icontains=q) |
                       Q(category__name__icontains=q) | Q(category__parent__name__icontains=q))
    active_cat = Category.objects.select_related("parent").filter(slug=cat).first() if cat else None
    if active_cat:
        qs = qs.filter(category_id__in=active_cat.with_descendant_ids())
    if group not in SECTIONS:
        group = ""
    if group:
        qs = qs.filter(category__group=group)
    if pmin.isdigit():
        qs = qs.filter(price__gte=int(pmin))
    if pmax.isdigit():
        qs = qs.filter(price__lte=int(pmax))
    if request.GET.get("instock"):
        qs = qs.filter(stock__gt=0)
    qs = qs.order_by({"low": "price", "high": "-price", "new": "-created", "name": "name"}.get(sort, "-created"), "-id")

    page = Paginator(qs, 12).get_page(request.GET.get("page"))
    params = request.GET.copy()
    params.pop("page", None)
    tree = get_tree(request)
    # sub-category buttons: the children of this category, or its brothers/sisters when a child is open
    family = None
    if active_cat:
        family = tree["by_slug"].get(active_cat.parent.slug) if active_cat.parent_id else tree["by_slug"].get(active_cat.slug)
        if family is not None and not family.kids:
            family = None
    section_key = group or (active_cat.group if active_cat else "")
    in_sarees = bool(active_cat and (active_cat.slug == "sarees" or (active_cat.parent_id and active_cat.parent.slug == "sarees")))
    nav_active = "sarees" if in_sarees else (section_key or "shop")
    return render(request, "shop/product_list.html", {
        "nav_active": nav_active,
        "page": page, "q": q, "cat": cat, "group": group, "section_key": section_key,
        "section": SECTIONS.get(section_key), "sort": sort, "pmin": pmin, "pmax": pmax,
        "instock": bool(request.GET.get("instock")), "querystring": params.urlencode(),
        "active_cat": active_cat, "family": family, "total": page.paginator.count,
    })


def product_detail(request, slug):
    product = get_object_or_404(Product.objects.select_related("category", "category__parent"), slug=slug, is_active=True)
    related = list(Product.objects.filter(category=product.category, is_active=True).exclude(pk=product.pk)[:4])
    if len(related) < 4:  # top up from the same family (e.g. other sarees) and then the same section
        family_ids = (product.category.parent.with_descendant_ids() if product.category.parent_id else [product.category_id])
        extra = Product.objects.filter(category_id__in=family_ids, is_active=True).exclude(pk__in=[product.pk, *[r.pk for r in related]])
        related += list(extra[:4 - len(related)])
    if len(related) < 4:
        extra = Product.objects.filter(category__group=product.category.group, is_active=True)\
            .exclude(pk__in=[product.pk, *[r.pk for r in related]]).order_by("-featured", "-id")
        related += list(extra[:4 - len(related)])
    reviews = product.reviews.select_related("user")
    my_review = reviews.filter(user=request.user).first() if request.user.is_authenticated else None
    in_sarees = bool(product.category.parent_id and product.category.parent.slug == "sarees")
    return render(request, "shop/product_detail.html", {
        "nav_active": "sarees" if in_sarees else product.category.group,
        "product": product, "related": related, "reviews": reviews, "my_review": my_review,
        "review_form": ReviewForm(instance=my_review), "max_qty": min(product.stock, 10),
        "overview": [para for para in product.description.split("\n\n") if para.strip()],
    })


def search_suggest(request):
    q = request.GET.get("q", "").strip()
    if len(q) < 2:
        return JsonResponse({"results": []})
    items = Product.objects.filter(is_active=True).filter(Q(name__icontains=q) | Q(category__name__icontains=q) | Q(category__parent__name__icontains=q))[:6]
    return JsonResponse({"results": [
        {"name": p.name, "url": p.get_absolute_url(), "price": int(p.price), "category": p.category.name,
         "image": photo(p.image)} for p in items]})


@login_required
@require_POST
def add_review(request, slug):
    product = get_object_or_404(Product, slug=slug)
    existing = Review.objects.filter(product=product, user=request.user).first()
    form = ReviewForm(request.POST, instance=existing)
    if form.is_valid():
        r = form.save(commit=False)
        r.product, r.user = product, request.user
        r.save()
        messages.success(request, "Thanks! Your review has been saved.")
    else:
        messages.error(request, "Please choose a rating from 1 to 5.")
    return redirect(product.get_absolute_url() + "#reviews")


# ---------- cart ----------
@ajax_login_required
def cart_view(request):
    items = CartItem.objects.filter(user=request.user).select_related("product")
    subtotal, shipping, total = cart_totals(items)
    return render(request, "shop/cart.html", {
        "items": items, "subtotal": subtotal, "shipping": shipping, "total": total,
        "free_left": max(Decimal(settings.FREE_SHIPPING_ABOVE) - subtotal, 0),
        "has_problem": any(i.quantity > i.product.stock or not i.product.is_active for i in items),
    })


@ajax_login_required
@require_POST
def cart_add(request, product_id):
    product = get_object_or_404(Product, pk=product_id, is_active=True)
    try:
        qty = max(int(request.POST.get("quantity", 1)), 1)
    except ValueError:
        qty = 1
    size = request.POST.get("size", "").strip()
    if product.size_list:
        if size not in product.size_list:
            return reply(request, False, "Please select a size first.")
    else:
        size = ""
    if product.stock <= 0:
        return reply(request, False, f"Sorry, {product.name} is out of stock.")
    item, _ = CartItem.objects.get_or_create(user=request.user, product=product, size=size, defaults={"quantity": 0})
    new_qty = item.quantity + qty
    if new_qty > product.stock:
        if item.quantity == 0:
            item.delete()
        return reply(request, False, f"Only {product.stock} in stock for {product.name}.")
    item.quantity = new_qty
    item.save()
    return reply(request, True, f"Added “{product.name}” to your cart.")


def _cart_payload(request, item=None):
    items = CartItem.objects.filter(user=request.user).select_related("product")
    subtotal, shipping, total = cart_totals(items)
    data = {"subtotal": str(subtotal), "shipping": str(shipping), "total": str(total),
            "free_left": str(max(Decimal(settings.FREE_SHIPPING_ABOVE) - subtotal, 0)), "empty": not items.exists()}
    if item is not None:
        data.update({"item_subtotal": str(item.subtotal), "quantity": item.quantity})
    return data


@ajax_login_required
@require_POST
def cart_update(request, item_id):
    item = get_object_or_404(CartItem, pk=item_id, user=request.user)
    action = request.POST.get("action")
    if action == "inc":
        if item.quantity + 1 > item.product.stock:
            return reply(request, False, f"Only {item.product.stock} available in stock.", **_cart_payload(request, item))
        item.quantity += 1
    elif action == "dec":
        item.quantity -= 1
    else:
        try:
            item.quantity = int(request.POST.get("quantity", 1))
        except ValueError:
            return reply(request, False, "Invalid quantity.")
        if item.quantity > item.product.stock:
            item.quantity = item.product.stock
            item.save()
            return reply(request, False, f"Only {item.product.stock} available in stock.", **_cart_payload(request, item))
    if item.quantity <= 0:
        item.delete()
        return reply(request, True, "Item removed from cart.", **_cart_payload(request))
    item.save()
    return reply(request, True, "Cart updated.", **_cart_payload(request, item))


@ajax_login_required
@require_POST
def cart_remove(request, item_id):
    get_object_or_404(CartItem, pk=item_id, user=request.user).delete()
    return reply(request, True, "Item removed from cart.", **_cart_payload(request))


# ---------- wishlist ----------
@ajax_login_required
@require_POST
def wishlist_toggle(request, product_id):
    product = get_object_or_404(Product, pk=product_id)
    obj, created = Wishlist.objects.get_or_create(user=request.user, product=product)
    if not created:
        obj.delete()
    msg = "Saved to your wishlist ♥" if created else "Removed from wishlist."
    if is_ajax(request):
        return JsonResponse({"ok": True, "added": created, "message": msg,
                             "count": Wishlist.objects.filter(user=request.user).count()})
    messages.success(request, msg)
    return redirect(request.META.get("HTTP_REFERER") or "wishlist")


@login_required
def wishlist_view(request):
    items = Wishlist.objects.filter(user=request.user).select_related("product__category")
    return render(request, "shop/wishlist.html", {"items": items})


# ---------- checkout & orders ----------
@login_required
def checkout(request):
    import uuid
    # Double-click / refresh protection: if this checkout session already produced an order, show it.
    if request.method == "POST":
        token = request.session.get("checkout_token")
        existing = Order.objects.filter(token=token, user=request.user).first() if token else None
        if existing:
            return redirect("order_confirmation", existing.order_number)

    items = list(CartItem.objects.filter(user=request.user).select_related("product"))
    if not items:
        messages.info(request, "Your cart is empty. Add something you love first!")
        return redirect("product_list")
    subtotal, shipping, total = cart_totals(items)

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            order = place_order(request, form.cleaned_data)
            if order:
                return redirect("order_confirmation", order.order_number)
            return redirect("cart")
    else:
        form = CheckoutForm(initial={"full_name": request.user.get_full_name(), "payment_method": "cod"})
        request.session["checkout_token"] = str(uuid.uuid4())

    if "checkout_token" not in request.session:
        request.session["checkout_token"] = str(uuid.uuid4())
    return render(request, "shop/checkout.html", {"form": form, "items": items, "subtotal": subtotal,
                                                   "shipping": shipping, "total": total})


def place_order(request, data):
    """Server-side order creation. Prices and stock are always re-read from the database."""
    with transaction.atomic():
        cart = list(CartItem.objects.select_for_update().filter(user=request.user).select_related("product"))
        if not cart:
            messages.error(request, "Your cart is empty.")
            return None
        # lock the product rows and re-validate everything
        products = {p.pk: p for p in Product.objects.select_for_update().filter(pk__in=[c.product_id for c in cart])}
        problems = []
        for c in cart:
            p = products[c.product_id]
            if not p.is_active:
                problems.append(f"“{p.name}” is no longer available.")
            elif c.quantity > p.stock:
                problems.append(f"Only {p.stock} left of “{p.name}” (you have {c.quantity} in your cart).")
        if problems:
            for m in problems:
                messages.error(request, m)
            return None

        subtotal = sum((products[c.product_id].price * c.quantity for c in cart), Decimal("0"))
        shipping = Decimal("0") if subtotal >= settings.FREE_SHIPPING_ABOVE else Decimal(settings.SHIPPING_FEE)
        order = Order.objects.create(
            user=request.user, token=request.session.get("checkout_token"),
            full_name=data["full_name"], address=data["address"], city=data["city"], state=data["state"],
            postal_code=data["postal_code"], phone=data["phone"], payment_method=data["payment_method"],
            subtotal=subtotal, shipping=shipping, total=subtotal + shipping)
        for c in cart:
            p = products[c.product_id]
            OrderItem.objects.create(order=order, product=p, name=p.name, price=p.price,
                                     quantity=c.quantity, size=c.size, image=p.image)
            Product.objects.filter(pk=p.pk).update(stock=F("stock") - c.quantity)
        CartItem.objects.filter(user=request.user).delete()
    return order


@login_required
def order_confirmation(request, order_number):
    order = get_object_or_404(Order, order_number=order_number, user=request.user)
    return render(request, "shop/order_confirmation.html", {"order": order})


@login_required
def order_list(request):
    return render(request, "shop/order_list.html", {"orders": Order.objects.filter(user=request.user).prefetch_related("items")})


@login_required
def order_detail(request, order_number):
    order = get_object_or_404(Order, order_number=order_number, user=request.user)  # users only see their own
    steps = ["placed", "packed", "shipped", "delivered"]
    reached = steps.index(order.status) if order.status in steps else -1
    return render(request, "shop/order_detail.html", {"order": order, "steps": steps, "reached": reached})


@login_required
@require_POST
def order_cancel(request, order_number):
    with transaction.atomic():
        order = get_object_or_404(Order.objects.select_for_update(), order_number=order_number, user=request.user)
        if order.status != "placed":
            messages.error(request, "This order can no longer be cancelled.")
        else:
            for it in order.items.all():
                if it.product_id:
                    Product.objects.filter(pk=it.product_id).update(stock=F("stock") + it.quantity)
            order.status = "cancelled"
            order.save(update_fields=["status"])
            messages.success(request, f"Order {order.order_number} was cancelled.")
    return redirect("order_detail", order_number)


@login_required
def account(request):
    orders = Order.objects.filter(user=request.user)
    return render(request, "shop/account.html", {
        "order_count": orders.count(), "recent": orders[:3],
        "wishlist_count": Wishlist.objects.filter(user=request.user).count()})


def _square_jpeg(upload, size=400):
    """Centre-crop the uploaded picture to a square and shrink it, so avatars stay small and tidy."""
    from io import BytesIO
    from django.core.files.base import ContentFile
    from PIL import Image, ImageOps
    img = ImageOps.exif_transpose(Image.open(upload)).convert("RGB")
    img = ImageOps.fit(img, (size, size), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "JPEG", quality=88, optimize=True)
    return ContentFile(buf.getvalue())


@login_required
@require_POST
def account_photo(request):
    form = ProfilePhotoForm(request.POST, request.FILES)
    if form.is_valid():
        prof, _ = Profile.objects.get_or_create(user=request.user)
        if prof.photo:
            prof.photo.delete(save=False)
        prof.photo.save(f"user{request.user.pk}.jpg", _square_jpeg(form.cleaned_data["photo"]), save=True)
        messages.success(request, "Your profile photo was updated.")
    else:
        messages.error(request, form.errors["photo"][0])
    return redirect("account")


@login_required
@require_POST
def account_photo_remove(request):
    prof = Profile.objects.filter(user=request.user).first()
    if prof and prof.photo:
        prof.photo.delete(save=False)
        prof.photo = ""
        prof.save()
        messages.success(request, "Profile photo removed.")
    return redirect("account")


# ---------- auth ----------
def register(request):
    if request.user.is_authenticated:
        return redirect("home")
    form = RegisterForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, f"Welcome to {settings.STORE_NAME}, {user.first_name}! ")
        return redirect("home")
    return render(request, "registration/register.html", {"form": form})


def logout_view(request):
    logout(request)
    messages.success(request, "You have been logged out.")
    return redirect("login")
