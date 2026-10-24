from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.urls import reverse

from .models import CartItem, Category, Order, Product

User = get_user_model()
AJAX = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}
ADDR = {"full_name": "Asha Patil", "phone": "9876543210", "address": "12 MG Road", "city": "Jalgaon",
        "state": "Maharashtra", "postal_code": "425001", "payment_method": "cod"}


class StoreFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        call_command("seed", verbosity=0)

    def register(self, email="asha@example.com", pw="secret123"):
        return self.client.post(reverse("register"), {"name": "Asha Patil", "email": email,
                                                       "password": pw, "confirm_password": pw})

    def test_homepage_and_public_pages_render(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "<title>ArtiVerse | Royal Women's Fashion &amp; Accessories</title>", html=False)
        self.assertContains(r, "royal-hero")
        self.assertNotContains(r, "StyleHub")
        for group in ("clothing", "accessories"):
            self.assertEqual(self.client.get(reverse("product_list") + f"?group={group}").status_code, 200)
            self.assertEqual(self.client.get(reverse("collection", args=[group])).status_code, 200)
        self.assertEqual(self.client.get("/collection/men/").status_code, 404)
        for name in ("login", "register", "product_list", "password_reset"):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)
        p = Product.objects.first()
        self.assertEqual(self.client.get(p.get_absolute_url()).status_code, 200)

    def test_women_only_no_mens_section(self):
        html = self.client.get("/").content.decode()
        nav = html[html.index('id="nav-links"'):html.index("</nav>")]
        self.assertNotIn(">Men<", nav)
        self.assertFalse(Category.objects.filter(slug__in=["formal-pants", "shirts", "belts"]).exists())
        import re
        self.assertFalse([p.name for p in Product.objects.all() if re.search(r"\b(men|mens|men's|gents|boys)\b", p.name.lower())])
        self.assertEqual(set(Category.objects.values_list("group", flat=True)), {"clothing", "accessories"})

    def test_accessories_and_clothing_options(self):
        acc = self.client.get(reverse("collection", args=["accessories"])).content.decode()
        for label in ("Necklaces", "Anklets", "Bracelets", "Earrings", "Rings", "Bajubandh", "Chashmas", "Watches",
                      "Perfumes", "Heels", "Purses &amp; Bags"):
            self.assertIn(label, acc)
        clo = self.client.get(reverse("collection", args=["clothing"])).content.decode()
        for label in ("South Indian Sarees", "Banarasi Sarees", "Fancy Sarees", "Party Wear Sarees", "Daily Use Sarees",
                      "Bodycon", "Traditional", "Kurtis", "Western", "Tops &amp; Tunics", "Jeans"):
            self.assertIn(label, clo)

    def test_parent_category_lists_children_and_files_exist(self):
        from django.contrib.staticfiles import finders
        r = self.client.get(reverse("product_list"), {"category": "sarees"})
        self.assertEqual(r.context["total"], Product.objects.filter(category__parent__slug="sarees").count())
        self.assertEqual(self.client.get(reverse("product_list"), {"category": "rings"}).context["total"], 7)
        for p in Product.objects.all():
            self.assertTrue(finders.find(p.image), p.image)
            self.assertTrue(p.highlight_list, p.name)

    def test_register_validation_and_hashing(self):
        r = self.client.post(reverse("register"), {"name": "A", "email": "bad", "password": "123", "confirm_password": "999"})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(User.objects.exists())
        self.register()
        u = User.objects.get(email="asha@example.com")
        self.assertNotEqual(u.password, "secret123")
        self.assertTrue(u.password.startswith("pbkdf2_"))
        self.client.get(reverse("logout"))
        r2 = self.register()  # duplicate
        self.assertContains(r2, "already exists")

    def test_login_logout(self):
        User.objects.create_user("a@x.com", "a@x.com", "secret123")
        bad = self.client.post(reverse("login"), {"username": "a@x.com", "password": "nope"})
        self.assertContains(bad, "Incorrect email or password")
        ok = self.client.post(reverse("login"), {"username": "A@X.com", "password": "secret123"})
        self.assertRedirects(ok, reverse("home"))
        self.assertEqual(self.client.get(reverse("home")).status_code, 200)
        self.client.get(reverse("logout"))
        self.assertRedirects(self.client.get(reverse("checkout")), reverse("login") + "?next=/checkout/")

    def test_all_categories_and_search_filters(self):
        self.register()
        for c in Category.objects.all():
            r = self.client.get(reverse("product_list"), {"category": c.slug})
            self.assertEqual(r.status_code, 200)
            self.assertGreater(r.context["total"], 0, c.slug)
        self.assertGreater(self.client.get(reverse("product_list"), {"q": "saree"}).context["total"], 3)
        self.assertEqual(self.client.get(reverse("product_list"), {"q": "zzzz"}).context["total"], 0)
        r = self.client.get(reverse("product_list"), {"group": "accessories", "sort": "low", "min": 1000, "max": 1500})
        prices = [p.price for p in r.context["page"]]
        self.assertEqual(prices, sorted(prices))
        self.assertTrue(all(1000 <= p <= 1500 for p in prices))
        self.assertEqual(self.client.get(reverse("search_suggest"), {"q": "watch"}).json()["results"][0]["category"], "Watches")
        for name in ("home", "cart", "wishlist", "order_list", "account"):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

    def test_cart_stock_rules_and_checkout(self):
        self.register()
        saree = Product.objects.get(name__startswith="Maroon & Gold Kanjivaram")
        jeans = Product.objects.get(category__slug="jeans", name__startswith="Dark Indigo")
        # size required
        r = self.client.post(reverse("cart_add", args=[jeans.id]), {"quantity": 1}, **AJAX)
        self.assertEqual(r.status_code, 400)
        # cannot exceed stock
        r = self.client.post(reverse("cart_add", args=[saree.id]), {"quantity": saree.stock + 1}, **AJAX)
        self.assertEqual(r.status_code, 400)
        r = self.client.post(reverse("cart_add", args=[saree.id]), {"quantity": 2}, **AJAX)
        self.assertEqual(r.json()["cart_count"], 2)
        r = self.client.post(reverse("cart_add", args=[jeans.id]), {"quantity": 1, "size": "32"}, **AJAX)
        self.assertEqual(r.json()["cart_count"], 3)
        item = CartItem.objects.get(product=saree)
        r = self.client.post(reverse("cart_update", args=[item.id]), {"action": "inc"}, **AJAX).json()
        self.assertEqual(r["quantity"], 3)
        r = self.client.post(reverse("cart_update", args=[item.id]), {"action": "dec"}, **AJAX).json()
        self.assertEqual(r["quantity"], 2)
        expected = 2 * saree.price + jeans.price
        self.assertEqual(float(r["subtotal"]), float(expected))
        self.assertEqual(float(r["shipping"]), 0.0)  # above free-shipping threshold
        # cart survives a "refresh" (new request) because it's in the DB
        from django.utils.html import escape
        self.assertContains(self.client.get(reverse("cart")), escape(saree.name))

        # checkout: bad data rejected
        self.client.get(reverse("checkout"))
        bad = dict(ADDR, phone="123", postal_code="12")
        r = self.client.post(reverse("checkout"), bad)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Order.objects.exists())
        # good order; stock reduced from DB prices
        before = saree.stock
        r = self.client.post(reverse("checkout"), ADDR)
        order = Order.objects.get()
        self.assertRedirects(r, reverse("order_confirmation", args=[order.order_number]))
        self.assertEqual(order.total, expected)
        self.assertEqual(order.items.count(), 2)
        saree.refresh_from_db()
        self.assertEqual(saree.stock, before - 2)
        self.assertFalse(CartItem.objects.exists())
        # double-submit does not create a second order
        self.client.post(reverse("checkout"), ADDR)
        self.assertEqual(Order.objects.count(), 1)
        self.assertContains(self.client.get(reverse("order_confirmation", args=[order.order_number])), order.order_number)
        self.assertContains(self.client.get(reverse("order_list")), order.order_number)

        # price change after purchase doesn't change the saved order
        saree.price = 1
        saree.save()
        order.refresh_from_db()
        self.assertEqual(order.total, expected)

        # cancel restores stock
        self.client.post(reverse("order_cancel", args=[order.order_number]))
        saree.refresh_from_db()
        self.assertEqual(saree.stock, before)

    def test_checkout_blocks_stale_cart_and_empty_cart(self):
        self.register()
        self.assertRedirects(self.client.get(reverse("checkout")), reverse("product_list"))
        p = Product.objects.get(name__startswith="Maroon & Gold Kanjivaram")
        self.client.post(reverse("cart_add", args=[p.id]), {"quantity": 3}, **AJAX)
        Product.objects.filter(pk=p.pk).update(stock=1)  # someone else bought it meanwhile
        self.client.get(reverse("checkout"))
        r = self.client.post(reverse("checkout"), ADDR)
        self.assertRedirects(r, reverse("cart"))
        self.assertFalse(Order.objects.exists())
        self.assertEqual(Product.objects.get(pk=p.pk).stock, 1)

    def test_users_cannot_see_each_others_orders(self):
        self.register()
        p = Product.objects.get(name__startswith="Golden Butterfly Charm Anklet")
        self.client.post(reverse("cart_add", args=[p.id]), {"quantity": 1}, **AJAX)
        self.client.get(reverse("checkout"))
        self.client.post(reverse("checkout"), ADDR)
        order = Order.objects.get()
        self.client.get(reverse("logout"))
        self.register("other@example.com")
        self.assertEqual(self.client.get(reverse("order_detail", args=[order.order_number])).status_code, 404)
        self.assertEqual(self.client.get(reverse("order_confirmation", args=[order.order_number])).status_code, 404)
        self.assertEqual(self.client.post(reverse("order_cancel", args=[order.order_number])).status_code, 404)
        self.assertNotContains(self.client.get(reverse("order_list")), order.order_number)

    def test_wishlist_review_and_anonymous_cart(self):
        p = Product.objects.first()
        r = self.client.post(reverse("cart_add", args=[p.id]), {"quantity": 1}, **AJAX)
        self.assertEqual(r.status_code, 401)
        self.register()
        self.assertTrue(self.client.post(reverse("wishlist_toggle", args=[p.id]), **AJAX).json()["added"])
        self.assertContains(self.client.get(reverse("wishlist")), p.name)
        self.assertFalse(self.client.post(reverse("wishlist_toggle", args=[p.id]), **AJAX).json()["added"])
        self.client.post(reverse("add_review", args=[p.slug]), {"rating": 4, "comment": "Lovely"})
        self.assertContains(self.client.get(p.get_absolute_url()), "Lovely")
        self.client.post(reverse("add_review", args=[p.slug]), {"rating": 9})
        self.assertEqual(p.reviews.count(), 1)

    def test_password_reset_email(self):
        User.objects.create_user("a@x.com", "a@x.com", "secret123")
        self.client.post(reverse("password_reset"), {"email": "a@x.com"})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/reset/", mail.outbox[0].body)

    def test_admin_requires_staff(self):
        self.register()
        self.assertEqual(self.client.get("/admin/").status_code, 302)
        User.objects.create_superuser("root", "root@x.com", "pw12345678")
        self.client.logout()
        self.client.login(username="root", password="pw12345678")
        for m in ("product", "order", "category"):
            self.assertEqual(self.client.get(f"/admin/shop/{m}/").status_code, 200)


class ProfilePhotoTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user("anu", "anu@example.com", "pass12345", first_name="Anu")
        self.client.force_login(self.user)

    def _png(self, name="me.png"):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = BytesIO(); Image.new("RGB", (600, 300), "red").save(buf, "PNG")
        return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")

    def test_upload_and_remove_photo(self):
        import shutil, tempfile
        from django.test import override_settings
        tmp = tempfile.mkdtemp()
        try:
            with override_settings(MEDIA_ROOT=tmp):
                r = self.client.post(reverse("account_photo"), {"photo": self._png()})
                self.assertRedirects(r, reverse("account"))
                prof = self.user.profile
                self.assertTrue(prof.photo.name.startswith("avatars/"))
                self.assertContains(self.client.get(reverse("account")), "avatars/")
                self.client.post(reverse("account_photo_remove"))
                prof.refresh_from_db()
                self.assertFalse(prof.photo)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_rejects_non_image(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        bad = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        self.client.post(reverse("account_photo"), {"photo": bad})
        self.assertFalse(hasattr(self.user, "profile") and self.user.profile.photo)

    def test_nav_has_no_orders_or_logout(self):
        html = self.client.get(reverse("home")).content.decode()
        nav = html[html.index('id="nav-links"'):html.index("</nav>")]
        self.assertNotIn("My Orders", nav); self.assertNotIn("Logout", nav)
