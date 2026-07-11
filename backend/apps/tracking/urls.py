from django.urls import path
from .views import BusTimingsView

urlpatterns = [
    path('buses/', BusTimingsView.as_view(), name='bus-timings'),
]
