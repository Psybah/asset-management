from django.conf import settings
from django.conf.urls.static import static
from django.urls import re_path
from django.views.static import serve
from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from accounts import views as account_views
from assets import views as asset_views
from survey import views as survey_views

router = DefaultRouter()
router.register("categories", asset_views.CategoryViewSet, basename="category")
router.register("locations", asset_views.LocationViewSet, basename="location")
router.register("departments", account_views.DepartmentViewSet, basename="department")
router.register("people", account_views.PersonViewSet, basename="person")
router.register("assets", asset_views.AssetViewSet, basename="asset")
router.register("assignments", asset_views.AssignmentViewSet, basename="assignment")
router.register("maintenance", asset_views.MaintenanceViewSet, basename="maintenance")
router.register("audit", asset_views.AuditLogViewSet, basename="audit")

api = [
    path("auth/login/", account_views.login, name="login"),
    path("auth/me/", account_views.me, name="me"),
    path("auth/logout/", account_views.logout, name="logout"),
    path("dashboard/", asset_views.dashboard, name="dashboard"),
    path("dashboard/value-trend/", asset_views.value_trend, name="value-trend"),
    path("public/assets/<str:tag>/", asset_views.public_asset, name="public-asset"),
    re_path(r"^reports/assets\.csv/?$", asset_views.assets_csv, name="assets-csv"),
    re_path(r"^reports/survey\.csv/?$", survey_views.survey_csv, name="survey-csv"),
    path("survey/", survey_views.survey_submit, name="survey-submit"),
    path("survey/form/", survey_views.survey_form, name="survey-form"),
    path("survey/results/", survey_views.survey_results, name="survey-results"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api)),
]

if settings.DEBUG:  # uploaded asset photos
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVE_MEDIA:  # production: Django serves MEDIA_ROOT itself (no separate file server)
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]
