from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsManagerOrReadOnly(BasePermission):
    """Everyone authenticated may read; only manager/admin may write (staff get 403)."""

    message = "Your role is read-only. Ask a manager or admin to make this change."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "can_write", False))


class IsManager(BasePermission):
    """Manager or admin only, for reads too (e.g. survey results)."""

    message = "Only managers and admins can view this."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "can_write", False))
