from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Depot
from .serializers import DepotSerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        # Public read — needed for the registration form to list depots
        if request.method in permissions.SAFE_METHODS:
            return True
        # Write requires admin
        return request.user.is_authenticated and (
            request.user.is_superuser or request.user.role == 'ADMIN'
        )



class DepotViewSet(viewsets.ModelViewSet):
    queryset = Depot.objects.all()
    serializer_class = DepotSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'code', 'city']
    ordering_fields = ['name', 'city', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated or not user.is_superuser:
            qs = qs.filter(is_active=True)
        return qs

