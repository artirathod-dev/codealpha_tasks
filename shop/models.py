import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Avg
from django.urls import reverse


class Category(models.Model):
    """Two sections (clothing / accessories). A category can have a parent, e.g. Sarees > South Indian Sarees,
    Jewellery > Rings. Products are attached to the "leaf" categories."""
    GROUPS = [("clothing", "Clothing"), ("accessories", "Accessories")]
    name = models.CharField(max_length=60)
    slug = models.SlugField(unique=True)
    group = models.CharField(max_length=20, choices=GROUPS, default="clothing")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children",
                               help_text="Leave empty for a main category. Pick e.g. Sarees to make this a sub-category.")
    position = models.PositiveSmallIntegerField(default=0, help_text="Smaller numbers appear first in menus.")
    icon = models.CharField(max_length=8, blank=True, default="")
    tagline = models.CharField(max_length=120, blank=True)
    image = models.CharField(max_length=200, blank=True, help_text="Path under static/, e.g. img/products/x.jpg")

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.parent.name} > {self.name}" if self.parent_id else self.name

    def get_absolute_url(self):
        return f"{reverse('product_list')}?category={self.slug}"

    @property
    def is_parent(self):
        return self.children.exists()

    def with_descendant_ids(self):
        """This category's id plus the ids of its sub-categories (used to list a whole family, e.g. all Sarees)."""
        return [self.pk, *self.children.values_list("pk", flat=True)]


class Product(models.Model):
    name = models.CharField(max_length=140)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    price = models.DecimalField(max_digits=9, decimal_places=2)
    mrp = models.DecimalField("MRP (original price)", max_digits=9, decimal_places=2, null=True, blank=True)
    short_description = models.CharField(max_length=160)
    description = models.TextField(help_text="The overview shown on the product page (blank line = new paragraph).")
    highlights = models.TextField(blank=True, help_text="One highlight per line - shown as bullet points.")
    image = models.CharField(max_length=200, help_text="Path under static/, e.g. img/products/x.jpg")
    stock = models.PositiveIntegerField(default=10)
    sizes = models.CharField(max_length=120, blank=True, help_text="Comma separated, e.g. S,M,L,XL. Leave empty for one-size items.")
    featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created", "-id"]

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse("product_detail", args=[self.slug])

    @property
    def highlight_list(self):
        return [h.strip() for h in self.highlights.splitlines() if h.strip()]

    @property
    def size_list(self):
        return [s.strip() for s in self.sizes.split(",") if s.strip()]

    @property
    def discount_percent(self):
        if self.mrp and self.mrp > self.price:
            return int((self.mrp - self.price) / self.mrp * 100)
        return 0

    @property
    def is_new(self):
        from django.utils import timezone
        return (timezone.now() - self.created).days <= 30

    @property
    def avg_rating(self):
        return self.reviews.aggregate(a=Avg("rating"))["a"] or 0

    @property
    def in_stock(self):
        return self.stock > 0


class Wishlist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    added = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")
        ordering = ["-added"]


class CartItem(models.Model):
    """Cart is stored in the database per user, so it survives refreshes, logouts and devices."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart_items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    size = models.CharField(max_length=10, blank=True)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("user", "product", "size")
        ordering = ["id"]

    @property
    def subtotal(self):
        return self.product.price * self.quantity


class Order(models.Model):
    STATUS = [("placed", "Placed"), ("packed", "Packed"), ("shipped", "Shipped"),
              ("delivered", "Delivered"), ("cancelled", "Cancelled")]
    PAYMENT = [("cod", "Cash on Delivery"), ("demo", "Demo Online Payment (simulated)")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    order_number = models.CharField(max_length=20, unique=True, editable=False)
    token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)  # blocks double-submits
    full_name = models.CharField(max_length=120)
    address = models.TextField()
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    postal_code = models.CharField(max_length=10)
    phone = models.CharField(max_length=15)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    shipping = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=10, choices=PAYMENT, default="cod")
    status = models.CharField(max_length=12, choices=STATUS, default="placed")
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created"]

    def __str__(self):
        return self.order_number

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = "AV" + uuid.uuid4().hex[:8].upper()
        super().save(*args, **kwargs)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=140)
    price = models.DecimalField(max_digits=9, decimal_places=2)  # price at time of purchase
    quantity = models.PositiveIntegerField()
    size = models.CharField(max_length=10, blank=True)
    image = models.CharField(max_length=200, blank=True)

    @property
    def subtotal(self):
        return self.price * self.quantity


class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(max_length=600, blank=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("product", "user")
        ordering = ["-created"]


class Profile(models.Model):
    """Extra account details. Currently just the customer's profile photo."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    photo = models.ImageField(upload_to="avatars/", blank=True)

    def __str__(self):
        return f"Profile of {self.user}"
