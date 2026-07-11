from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DepotViewSet

router = DefaultRouter()
router.register(r'', DepotViewSet, basename='depot')

urlpatterns = [
    path('', include(router.urls)),
]
