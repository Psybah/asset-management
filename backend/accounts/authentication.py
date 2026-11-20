from rest_framework.authentication import TokenAuthentication

from .models import AccessToken


class MultiTokenAuthentication(TokenAuthentication):
    """`Authorization: Token <key>` against AccessToken: a user may hold several tokens (one per sign-in)."""

    model = AccessToken


class QueryParamTokenAuthentication(MultiTokenAuthentication):
    """Accepts `?token=<key>` (used for CSV download links), falling back to the header."""

    def authenticate(self, request):
        key = request.query_params.get("token")
        if key:
            return self.authenticate_credentials(key)
        return super().authenticate(request)
