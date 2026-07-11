from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PassViewSet,
    PassPricingViewSet,
    DailyPassViewSet,
    PassApplicationViewSet,
    PassDocumentViewSet,
    GeneratedPassViewSet,
)

router = DefaultRouter()
router.register(r'pricing', PassPricingViewSet, basename='pass-pricing')
router.register(r'daily', DailyPassViewSet, basename='daily-pass')
router.register(r'applications', PassApplicationViewSet, basename='pass-application')
router.register(r'documents', PassDocumentViewSet, basename='pass-document')
router.register(r'generated', GeneratedPassViewSet, basename='generated-pass')
router.register(r'', PassViewSet, basename='pass')

urlpatterns = [path('', include(router.urls))]
