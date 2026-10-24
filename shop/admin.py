from django.contrib import admin
from .models import Category, Product, Order, OrderItem, Review, Wishlist, CartItem, Profile

admin.site.site_header = "ArtiVerse Admin"
admin.site.site_title = "ArtiVerse Admin"

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "parent", "position", "slug")
    list_editable = ("position",)
    list_filter = ("group",)
    prepopulated_fields = {"slug": ("name",)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "stock", "featured", "is_active")
    list_editable = ("price", "stock", "featured", "is_active")
    list_filter = ("category__group", "category", "featured", "is_active")
    search_fields = ("name", "short_description")
    prepopulated_fields = {"slug": ("name",)}

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "name", "price", "quantity", "size", "image")
    can_delete = False

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "user", "total", "payment_method", "status", "created")
    list_editable = ("status",)
    list_filter = ("status", "payment_method", "created")
    search_fields = ("order_number", "user__email", "full_name", "phone")
    readonly_fields = ("order_number", "token", "user", "subtotal", "shipping", "total", "created")
    inlines = [OrderItemInline]

admin.site.register(Review)
admin.site.register(Wishlist)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "photo")
