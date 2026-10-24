import re
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.password_validation import validate_password
from .models import Profile, Review

User = get_user_model()


class EmailLoginForm(AuthenticationForm):
    username = forms.EmailField(label="Email", widget=forms.EmailInput(attrs={"placeholder": "you@example.com", "autofocus": True}))
    password = forms.CharField(label="Password", widget=forms.PasswordInput(attrs={"placeholder": "Your password"}))
    error_messages = {
        "invalid_login": "Incorrect email or password. Please try again.",
        "inactive": "This account is inactive.",
    }

    def clean_username(self):
        return self.cleaned_data["username"].strip().lower()


class RegisterForm(forms.Form):
    name = forms.CharField(max_length=60, widget=forms.TextInput(attrs={"placeholder": "Your full name"}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={"placeholder": "you@example.com"}))
    password = forms.CharField(widget=forms.PasswordInput(attrs={"placeholder": "At least 6 characters"}))
    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={"placeholder": "Repeat password"}))

    def clean_name(self):
        n = self.cleaned_data["name"].strip()
        if len(n) < 2:
            raise forms.ValidationError("Please enter your name.")
        return n

    def clean_email(self):
        e = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(username=e).exists() or User.objects.filter(email__iexact=e).exists():
            raise forms.ValidationError("An account with this email already exists. Try logging in.")
        return e

    def clean_password(self):
        p = self.cleaned_data["password"]
        validate_password(p)
        return p

    def clean(self):
        data = super().clean()
        if data.get("password") and data.get("confirm_password") and data["password"] != data["confirm_password"]:
            self.add_error("confirm_password", "Passwords do not match.")
        return data

    def save(self):
        d = self.cleaned_data
        first, _, last = d["name"].partition(" ")
        return User.objects.create_user(username=d["email"], email=d["email"], password=d["password"],
                                        first_name=first, last_name=last)


class CheckoutForm(forms.Form):
    full_name = forms.CharField(max_length=120, label="Full name")
    phone = forms.CharField(max_length=15, label="Phone number", widget=forms.TextInput(attrs={"inputmode": "tel", "placeholder": "10-digit mobile number"}))
    address = forms.CharField(label="Delivery address", widget=forms.Textarea(attrs={"rows": 3, "placeholder": "House no., street, area"}))
    city = forms.CharField(max_length=80)
    state = forms.CharField(max_length=80)
    postal_code = forms.CharField(max_length=6, label="Postal code", widget=forms.TextInput(attrs={"inputmode": "numeric", "placeholder": "6-digit PIN"}))
    payment_method = forms.ChoiceField(choices=[("cod", "Cash on Delivery"), ("demo", "Demo online payment (simulated, no real money)")],
                                       widget=forms.RadioSelect, initial="cod")

    def clean_phone(self):
        p = re.sub(r"[\s\-+]", "", self.cleaned_data["phone"])
        if p.startswith("91") and len(p) == 12:
            p = p[2:]
        if not re.fullmatch(r"[6-9]\d{9}", p):
            raise forms.ValidationError("Enter a valid 10-digit Indian mobile number.")
        return p

    def clean_postal_code(self):
        p = self.cleaned_data["postal_code"].strip()
        if not re.fullmatch(r"\d{6}", p):
            raise forms.ValidationError("Postal code must be 6 digits.")
        return p


class ReviewForm(forms.ModelForm):
    rating = forms.IntegerField(min_value=1, max_value=5)

    class Meta:
        model = Review
        fields = ["rating", "comment"]
        widgets = {"comment": forms.Textarea(attrs={"rows": 3, "placeholder": "Share your experience (optional)"})}


class ProfilePhotoForm(forms.Form):
    photo = forms.ImageField(error_messages={"invalid_image": "Please choose a valid image (JPG, PNG or WebP)."})

    def clean_photo(self):
        f = self.cleaned_data["photo"]
        if f.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Photo is too large – please keep it under 5 MB.")
        return f
