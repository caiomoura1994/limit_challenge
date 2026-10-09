from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from fleet.views import VehicleViewSet
from maintenance.views import MaintenanceRecordViewSet, MechanicViewSet
from offices.views import OfficeViewSet
from server.views import health_check

router = DefaultRouter()
router.register("offices", OfficeViewSet, basename="office")
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("mechanics", MechanicViewSet, basename="mechanic")
router.register(
    "maintenance-records",
    MaintenanceRecordViewSet,
    basename="maintenance-record",
)

urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("api/token/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name="api-schema",
    ),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(
            url_name="api-schema",
            permission_classes=[AllowAny],
        ),
        name="api-docs",
    ),
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]
