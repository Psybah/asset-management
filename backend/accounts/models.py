from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Custom user with an organisational role and a home department."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        STAFF = "staff", "Staff"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )

    class Meta:
        ordering = ["first_name", "last_name", "username"]

    @property
    def name(self):
        return self.get_full_name() or self.username

    @property
    def initials(self):
        parts = [p for p in (self.first_name, self.last_name) if p]
        if not parts:
            parts = [self.username]
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][0] + parts[-1][0]).upper()

    @property
    def can_write(self):
        return self.is_superuser or self.role in (self.Role.ADMIN, self.Role.MANAGER)


class AccessToken(models.Model):
    """One API token per sign-in (DRF's built-in Token allows only one per user, so signing out
    on one device used to sign out everyone sharing that account)."""

    key = models.CharField(max_length=40, unique=True)
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="access_tokens")
    created = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.key:
            import secrets
            self.key = secrets.token_hex(20)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user} · {self.key[:6]}…"
