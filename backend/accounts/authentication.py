from rest_framework.authentication import TokenAuthentication


class QueryParamTokenAuthentication(TokenAuthentication):
    """Accepts `?token=<key>` (used for CSV download links), falling back to the header."""

    def authenticate(self, request):
        key = request.query_params.get("token")
        if key:
            return self.authenticate_credentials(key)
        return super().authenticate(request)
