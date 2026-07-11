"""
URL configuration for Smart Transport Solution.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/depots/', include('apps.depots.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/buses/', include('apps.buses.urls')),
    path('api/routes/', include('apps.routes.urls')),
    path('api/trips/', include('apps.trips.urls')),
    path('api/tickets/', include('apps.tickets.urls')),
    path('api/passes/', include('apps.passes.urls')),
    path('api/tracking/', include('apps.tracking.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/reports/', include('apps.reports.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
