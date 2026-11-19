from django.contrib.auth import authenticate
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from assets.audit import AuditedModelViewSetMixin

from .models import Department, User
from .serializers import DepartmentSerializer, PersonSerializer, UserSerializer


@api_view(["POST"])
@authentication_classes([])  # a stale token in the client must not block logging in
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")
    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_active:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentViewSet(AuditedModelViewSetMixin, viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    audit_entity = "department"

    def get_queryset(self):
        return Department.objects.annotate(asset_count=Count("assets", distinct=True)).order_by("name")


class PersonViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PersonSerializer

    def get_queryset(self):
        return (
            User.objects.filter(is_active=True)
            .select_related("department")
            .annotate(asset_count=Count("assigned_assets", distinct=True))
            .order_by("first_name", "last_name", "username")
        )
