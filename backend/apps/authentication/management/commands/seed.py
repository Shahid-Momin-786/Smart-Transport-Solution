import random
from datetime import date, timedelta, datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.depots.models import Depot
from apps.buses.models import Bus
from apps.routes.models import Route, Stop
from apps.trips.models import Trip
from apps.tickets.models import Ticket
from apps.passes.models import Pass
from apps.notifications.models import Notification

User = get_user_model()

DEPOT_DATA = [
    {'name': 'Central Depot', 'code': 'CD-01', 'city': 'Mumbai', 'address': '1 Central Road, Dadar, Mumbai', 'phone': '022-12345678'},
    {'name': 'Eastern Depot', 'code': 'ED-02', 'city': 'Mumbai', 'address': '15 Eastern Ave, Kurla, Mumbai', 'phone': '022-87654321'},
]

ROUTES_DATA = [
    {'route_number': 'R-101', 'route_name': 'Dadar to Bandra', 'source': 'Dadar', 'destination': 'Bandra', 'distance': 12.5, 'fare': 25},
    {'route_number': 'R-102', 'route_name': 'Dadar to Andheri', 'source': 'Dadar', 'destination': 'Andheri', 'distance': 18.3, 'fare': 35},
    {'route_number': 'R-103', 'route_name': 'Dadar to Thane', 'source': 'Dadar', 'destination': 'Thane', 'distance': 22.0, 'fare': 45},
    {'route_number': 'R-104', 'route_name': 'Dadar to Borivali', 'source': 'Dadar', 'destination': 'Borivali', 'distance': 28.5, 'fare': 55},
    {'route_number': 'R-201', 'route_name': 'Kurla to Ghatkopar', 'source': 'Kurla', 'destination': 'Ghatkopar', 'distance': 8.0, 'fare': 20},
    {'route_number': 'R-202', 'route_name': 'Kurla to Powai', 'source': 'Kurla', 'destination': 'Powai', 'distance': 10.5, 'fare': 25},
    {'route_number': 'R-203', 'route_name': 'Kurla to Mulund', 'source': 'Kurla', 'destination': 'Mulund', 'distance': 15.2, 'fare': 30},
    {'route_number': 'R-204', 'route_name': 'Kurla to Vikhroli', 'source': 'Kurla', 'destination': 'Vikhroli', 'distance': 6.8, 'fare': 18},
]

PASSENGER_NAMES = [
    'Aarav Sharma', 'Priya Patel', 'Rahul Mehta', 'Sneha Joshi', 'Vikram Singh',
    'Anita Desai', 'Rohan Gupta', 'Kavya Nair', 'Arjun Kumar', 'Pooja Iyer',
    'Suresh Rao', 'Meera Pillai', 'Aditya Thakur', 'Ritu Agarwal', 'Deepak Verma',
    'Sonal Mishra', 'Karan Bajaj', 'Divya Chandra', 'Nikhil Reddy', 'Pallavi Sinha',
]


class Command(BaseCommand):
    help = 'Seed the database with sample data for Smart Transport Solution'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Seeding database...'))

        # Create depots
        depots = []
        for d in DEPOT_DATA:
            depot, created = Depot.objects.get_or_create(code=d['code'], defaults=d)
            depots.append(depot)
            if created:
                self.stdout.write(f'  Created depot: {depot.name}')

        # Create superadmin
        superadmin, created = User.objects.get_or_create(
            email='superadmin@smts.app',
            defaults={
                'name': 'Super Admin',
                'role': 'ADMIN',
                'is_superuser': True,
                'is_staff': True,
                'is_active': True,
                'is_verified': True,
                'depot': depots[0],
            }
        )
        if created:
            superadmin.set_password('Admin@123')
            superadmin.save()
            self.stdout.write(f'  Created superadmin: {superadmin.email}')

        # Create depot admins
        for i, depot in enumerate(depots):
            admin_email = f'admin{i+1}@smts.app'
            admin, created = User.objects.get_or_create(
                email=admin_email,
                defaults={
                    'name': f'Depot Admin {i+1}',
                    'role': 'ADMIN',
                    'is_staff': True,
                    'is_active': True,
                    'is_verified': True,
                    'depot': depot,
                }
            )
            if created:
                admin.set_password('Admin@123')
                admin.save()
                self.stdout.write(f'  Created admin: {admin.email}')

        # Create buses
        buses_by_depot = {d.id: [] for d in depots}
        bus_statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'MAINTENANCE']
        for depot in depots:
            for j in range(5):
                bus_num = f"{depot.code}-BUS-{j+1:03d}"
                bus, created = Bus.objects.get_or_create(
                    bus_number=bus_num,
                    defaults={
                        'capacity': random.choice([40, 50, 60]),
                        'status': random.choice(bus_statuses),
                        'depot': depot,
                        'model': random.choice(['Tata Motors 1213', 'Ashok Leyland Eagle', 'BEST Volvo']),
                        'year': random.randint(2018, 2023),
                    }
                )
                buses_by_depot[depot.id].append(bus)

        # Create routes
        routes_by_depot = {d.id: [] for d in depots}
        for i, rd in enumerate(ROUTES_DATA):
            depot = depots[0] if i < 4 else depots[1]
            route, created = Route.objects.get_or_create(
                route_number=rd['route_number'],
                defaults={**rd, 'depot': depot}
            )
            if created:
                # Add 4 stops per route
                stop_names = [rd['source'], f'{rd["source"]} Junction', f'Mid {rd["destination"]}', rd['destination']]
                for k, stop_name in enumerate(stop_names):
                    Stop.objects.create(
                        route=route, name=stop_name, order=k+1,
                        arrival_offset=k * 10,
                        latitude=19.0760 + random.uniform(-0.1, 0.1),
                        longitude=72.8777 + random.uniform(-0.1, 0.1),
                    )
            routes_by_depot[depot.id].append(route)

        # Create passengers
        passengers_by_depot = {d.id: [] for d in depots}
        for i, name in enumerate(PASSENGER_NAMES):
            depot = depots[i % 2]
            email = f"{name.lower().replace(' ', '.')}@example.com"
            passenger, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'name': name,
                    'role': 'PASSENGER',
                    'is_active': True,
                    'is_verified': True,
                    'depot': depot,
                    'phone': f"98{random.randint(10000000, 99999999)}",
                }
            )
            if created:
                passenger.set_password('Pass@1234')
                passenger.save()
            passengers_by_depot[depot.id].append(passenger)

        # Create trips
        trips_by_depot = {d.id: [] for d in depots}
        for depot in depots:
            routes = routes_by_depot[depot.id]
            buses = buses_by_depot[depot.id]
            for k in range(6):
                route = random.choice(routes)
                bus = random.choice([b for b in buses if b.status == 'ACTIVE'] or buses)
                start = timezone.now() - timedelta(hours=random.randint(1, 48))
                status = random.choice(['COMPLETED', 'COMPLETED', 'COMPLETED', 'IN_PROGRESS', 'SCHEDULED'])
                trip, created = Trip.objects.get_or_create(
                    route=route, bus=bus, start_time=start,
                    defaults={
                        'depot': depot,
                        'end_time': start + timedelta(hours=1),
                        'status': status,
                        'current_lat': 19.0760 + random.uniform(-0.05, 0.05) if status == 'IN_PROGRESS' else None,
                        'current_lng': 72.8777 + random.uniform(-0.05, 0.05) if status == 'IN_PROGRESS' else None,
                    }
                )
                trips_by_depot[depot.id].append(trip)

        # Create tickets
        seat_letters = 'ABCDE'
        for depot in depots:
            passengers = passengers_by_depot[depot.id]
            trips = trips_by_depot[depot.id]
            used_seats = {}
            for _ in range(15):
                passenger = random.choice(passengers)
                trip = random.choice(trips)
                seat = f"{random.choice(seat_letters)}{random.randint(1, 10)}"
                key = (trip.id, seat)
                if key in used_seats:
                    continue
                used_seats[key] = True
                ticket_status = random.choice(['CONFIRMED', 'CONFIRMED', 'USED', 'CANCELLED'])
                Ticket.objects.get_or_create(
                    passenger=passenger,
                    trip=trip,
                    seat_number=seat,
                    defaults={
                        'depot': depot,
                        'fare': trip.route.fare,
                        'status': ticket_status,
                    }
                )

        # Create passes
        pass_types = ['WEEKLY', 'MONTHLY', 'STUDENT']
        fares = {'WEEKLY': 150, 'MONTHLY': 500, 'STUDENT': 250}
        for depot in depots:
            passengers = passengers_by_depot[depot.id]
            for _ in range(8):
                passenger = random.choice(passengers)
                ptype = random.choice(pass_types)
                valid_from = date.today() - timedelta(days=random.randint(0, 10))
                duration = 7 if ptype == 'WEEKLY' else 30
                Pass.objects.get_or_create(
                    passenger=passenger,
                    valid_from=valid_from,
                    defaults={
                        'depot': depot,
                        'pass_type': ptype,
                        'valid_to': valid_from + timedelta(days=duration),
                        'fare': fares[ptype],
                        'status': 'ACTIVE',
                        'student_id': f'STU-{random.randint(10000, 99999)}' if ptype == 'STUDENT' else '',
                    }
                )

        # Create notifications
        for depot in depots:
            passengers = passengers_by_depot[depot.id]
            admin = User.objects.filter(depot=depot, role='ADMIN').first()
            for p in passengers[:3]:
                Notification.objects.get_or_create(
                    title='Welcome to Smart Transport Solution',
                    user=p,
                    depot=depot,
                    defaults={'message': f'Hello {p.name}! Your account has been activated. Start exploring routes and booking tickets.'}
                )

        self.stdout.write(self.style.SUCCESS('\nDatabase seeded successfully!'))
        self.stdout.write('\nTest credentials:')
        self.stdout.write('  Superadmin:    superadmin@smts.app / Admin@123')
        self.stdout.write('  Depot Admin 1: admin1@smts.app / Admin@123  (Central Depot)')
        self.stdout.write('  Depot Admin 2: admin2@smts.app / Admin@123  (Eastern Depot)')
        self.stdout.write('  Passenger:     aarav.sharma@example.com / Pass@1234')
        self.stdout.write('  Passenger:     priya.patel@example.com / Pass@1234')
