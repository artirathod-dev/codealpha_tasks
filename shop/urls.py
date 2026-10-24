from django.contrib.auth import views as auth_views
from django.urls import path, reverse_lazy
from . import views
from .forms import EmailLoginForm

urlpatterns = [
    path("", views.home, name="home"),
    path("collection/<slug:group>/", views.collection, name="collection"),
    path("products/", views.product_list, name="product_list"),
    path("products/<slug:slug>/", views.product_detail, name="product_detail"),
    path("products/<slug:slug>/review/", views.add_review, name="add_review"),
    path("api/suggest/", views.search_suggest, name="search_suggest"),

    path("cart/", views.cart_view, name="cart"),
    path("cart/add/<int:product_id>/", views.cart_add, name="cart_add"),
    path("cart/update/<int:item_id>/", views.cart_update, name="cart_update"),
    path("cart/remove/<int:item_id>/", views.cart_remove, name="cart_remove"),

    path("wishlist/", views.wishlist_view, name="wishlist"),
    path("wishlist/toggle/<int:product_id>/", views.wishlist_toggle, name="wishlist_toggle"),

    path("checkout/", views.checkout, name="checkout"),
    path("order/<str:order_number>/confirmation/", views.order_confirmation, name="order_confirmation"),
    path("orders/", views.order_list, name="order_list"),
    path("orders/<str:order_number>/", views.order_detail, name="order_detail"),
    path("orders/<str:order_number>/cancel/", views.order_cancel, name="order_cancel"),
    path("account/", views.account, name="account"),
    path("account/photo/", views.account_photo, name="account_photo"),
    path("account/photo/remove/", views.account_photo_remove, name="account_photo_remove"),

    path("register/", views.register, name="register"),
    path("login/", auth_views.LoginView.as_view(template_name="registration/login.html",
                                                authentication_form=EmailLoginForm,
                                                redirect_authenticated_user=True), name="login"),
    path("logout/", views.logout_view, name="logout"),

    path("password-reset/", auth_views.PasswordResetView.as_view(
        template_name="registration/password_reset_form.html", email_template_name="registration/password_reset_email.txt",
        subject_template_name="registration/password_reset_subject.txt",
        success_url=reverse_lazy("password_reset_done")), name="password_reset"),
    path("password-reset/sent/", auth_views.PasswordResetDoneView.as_view(
        template_name="registration/password_reset_done.html"), name="password_reset_done"),
    path("reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(
        template_name="registration/password_reset_confirm.html",
        success_url=reverse_lazy("password_reset_complete")), name="password_reset_confirm"),
    path("reset/done/", auth_views.PasswordResetCompleteView.as_view(
        template_name="registration/password_reset_complete.html"), name="password_reset_complete"),
]
