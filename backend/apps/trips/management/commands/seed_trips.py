"""
Seed realistic PMPL bus timetables (Trips) for all buses.

Strategy:
- Pick the most popular/high-traffic routes across depots
- Assign buses round-robin across routes
- Generate departure slots from first_bus to last_bus with frequency intervals
- arrival_time = departure_time + route journey minutes
"""

from datetime import time, datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.trips.models import Trip
from apps.routes.models import Route, Stop
from apps.buses.models import Bus
from apps.depots.models import Depot


# ── Popular route numbers to seed timetables for ─────────────────────────────
# These are high-traffic PMPL corridors. The command also seeds any route
# that has a bus assigned to its depot, so all buses get trips.

PRIORITY_ROUTE_NUMBERS = [
    # Hinjawadi IT corridor
    '100-D', '100-U', '101-D', '101-U',
    # Swargate / South Pune
    '1-D', '1-U', '2-D', '2-U', '3-D', '3-U',
    '4-D', '4-U', '11-D', '11-U',
    # Hadapsar / East Pune
    '50-D', '50-U', '51-D', '51-U',
    # Bhakti Shakti / Nigdi
    '200-D', '200-U', '201-D', '201-U',
    # Pimpri / Bhosari
    '300-D', '300-U',
    # Katraj
    '150-D', '150-U',
    # Kothrud
    '70-D', '70-U', '71-D', '71-U',
    # Night routes
    '1-D-NGT', '100-D-NGT',
    # VJR (Vajra AC)
    'VJR1-D', 'VJR1-U', 'VJR2A-D', 'VJR2A-U',
]

# ── Timetable templates (first_dep, last_dep, frequency_minutes) ──────────────
# Each route type gets a realistic schedule pattern

SCHEDULE_PATTERNS = {
    'peak':     {'first': time(5, 30), 'last': time(23, 0),  'freq': 15},
    'standard': {'first': time(5, 45), 'last': time(22, 30), 'freq': 20},
    'limited':  {'first': time(6, 0),  'last': time(22, 0),  'freq': 30},
    'night':    {'first': time(22, 0), 'last': time(23, 30), 'freq': 60},
    'vjr':      {'first': time(7, 0),  'last': time(21, 0),  'freq': 30},
}

ROUTE_PATTERN_MAP = {
    'NGT': 'night',
    'VJR': 'vjr',
}


def get_pattern(route_number):
    rn = route_number.upper()
    for key, pattern in ROUTE_PATTERN_MAP.items():
        if key in rn:
            return SCHEDULE_PATTERNS[pattern]
    # Main routes (numbered 1-50) get peak; others get standard
    try:
        num = int(rn.split('-')[0])
        if num <= 50:
            return SCHEDULE_PATTERNS['peak']
        elif num <= 150:
            return SCHEDULE_PATTERNS['standard']
        else:
            return SCHEDULE_PATTERNS['limited']
    except ValueError:
        return SCHEDULE_PATTERNS['standard']


def get_journey_minutes(route):
    """Get total journey minutes from stop offsets."""
    stops = list(Stop.objects.filter(route=route).order_by('order'))
    if stops:
        return stops[-1].arrival_offset or sum(s.travel_minutes for s in stops)
    # Fallback: estimate from distance (avg 18 km/h city speed)
    return max(10, int(float(route.distance) / 18 * 60))


def add_minutes(t, mins):
    """Add minutes to a time object, wrapping at midnight."""
    dt = datetime.combine(datetime.today(), t) + timedelta(minutes=mins)
    return dt.time()


class Command(BaseCommand):
    help = 'Seed realistic PMPL bus timetables (trips) for all routes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing trips before seeding',
        )
        parser.add_argument(
            '--max-routes',
            type=int,
            default=80,
            help='Maximum number of routes to seed trips for (default: 80)',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        max_routes = options['max_routes']

        if clear:
            deleted = Trip.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing trips.'))

        buses = list(Bus.objects.filter(status='ACTIVE').select_related('depot'))
        if not buses:
            self.stdout.write(self.style.ERROR('No active buses found. Run seed_depots first.'))
            return

        self.stdout.write(f'Found {len(buses)} active buses.')

        # ── Select routes to seed ─────────────────────────────────────────────
        # Priority routes first, then fill up to max_routes from remaining
        priority_routes = list(
            Route.objects.filter(
                route_number__in=PRIORITY_ROUTE_NUMBERS,
                is_active=True
            ).select_related('depot')
        )

        # Fill remaining slots from random selection across all depots
        needed = max(0, max_routes - len(priority_routes))
        extra_routes = list(
            Route.objects.filter(is_active=True)
            .exclude(route_number__in=PRIORITY_ROUTE_NUMBERS)
            .select_related('depot')
            .order_by('route_number')[:needed]
        )

        all_routes = priority_routes + extra_routes
        self.stdout.write(f'Seeding trips for {len(all_routes)} routes...')

        total_trips = 0
        bus_index = 0
        errors = []

        with transaction.atomic():
            for route in all_routes:
                # Skip routes that already have trips (unless --clear was used)
                if not clear and route.trips.exists():
                    continue

                journey_mins = get_journey_minutes(route)
                pattern = get_pattern(route.route_number)

                # Assign a bus (round-robin, prefer same depot)
                depot_buses = [b for b in buses if b.depot_id == route.depot_id]
                available = depot_buses if depot_buses else buses
                bus = available[bus_index % len(available)]
                bus_index += 1

                # Build departure slots
                dep = pattern['first']
                last = pattern['last']
                freq = pattern['freq']

                try:
                    # Create one Trip record with frequency (represents recurring service)
                    arr = add_minutes(dep, journey_mins)

                    # Clamp arrival to last service time
                    last_arr = add_minutes(last, journey_mins)

                    Trip.objects.create(
                        route=route,
                        bus=bus,
                        depot=route.depot,
                        departure_time=dep,
                        arrival_time=arr,
                        frequency=freq,
                        avg_stop_minutes=3,
                        status='SCHEDULED',
                        delay_minutes=0,
                        notes=f'PMPL {route.route_number} service | {freq}-min frequency',
                    )
                    total_trips += 1

                    # Also create distinct morning peak trips for popular routes
                    if pattern == SCHEDULE_PATTERNS['peak']:
                        peak_slots = [
                            time(6, 0), time(7, 30), time(9, 0),
                            time(17, 0), time(18, 30), time(20, 0),
                        ]
                        for slot in peak_slots:
                            arr_slot = add_minutes(slot, journey_mins)
                            Trip.objects.create(
                                route=route,
                                bus=bus,
                                depot=route.depot,
                                departure_time=slot,
                                arrival_time=arr_slot,
                                frequency=0,  # single trip
                                status='SCHEDULED',
                                notes=f'PMPL {route.route_number} peak trip',
                            )
                            total_trips += 1

                except Exception as e:
                    errors.append(f'{route.route_number}: {e}')

        self.stdout.write(self.style.SUCCESS(
            f'\n[SUCCESS] Trip Seeding Complete!'
            f'\n   Routes covered  : {len(all_routes)}'
            f'\n   Total trips     : {total_trips}'
            f'\n   Total in DB     : {Trip.objects.count()}'
            f'\n   Buses used      : {len(buses)}'
        ))

        if errors:
            self.stdout.write(self.style.ERROR(f'\nErrors ({len(errors)}):'))
            for e in errors[:5]:
                self.stdout.write(f'  {e}')

        self.stdout.write(
            '\nTip: Re-run with --clear to reset all trips.\n'
            'Tip: Use --max-routes 200 to seed more routes.\n'
        )
