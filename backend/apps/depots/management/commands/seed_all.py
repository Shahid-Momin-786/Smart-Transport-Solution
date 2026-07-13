"""
Master seeding command — runs all seed steps in the correct order.

Usage:
    python manage.py seed_all              # runs everything
    python manage.py seed_all --only routes
    python manage.py seed_all --only stops
    python manage.py seed_all --only depots
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Run all PMPL seed commands in the correct order: depots → routes → stops'

    def add_arguments(self, parser):
        parser.add_argument(
            '--only',
            type=str,
            choices=['depots', 'routes', 'stops'],
            help='Run only one specific seed step',
        )
        parser.add_argument(
            '--no-clear',
            action='store_true',
            help='Pass --no-clear to seed_routes (keeps existing routes)',
        )

    def handle(self, *args, **options):
        only = options.get('only')
        no_clear = options.get('no_clear')

        self.stdout.write(self.style.WARNING('\n=== SMTS Master Seed ===\n'))

        if not only or only == 'depots':
            self.stdout.write(self.style.HTTP_INFO('[1/3] Seeding depots...'))
            call_command('seed_depots')

        if not only or only == 'routes':
            self.stdout.write(self.style.HTTP_INFO('\n[2/3] Seeding PMPL routes...'))
            if no_clear:
                call_command('seed_routes', no_clear=True)
            else:
                call_command('seed_routes')

        if not only or only == 'stops':
            self.stdout.write(self.style.HTTP_INFO('\n[3/3] Seeding stops...'))
            call_command('seed_stops', clear=True)

        self.stdout.write(self.style.SUCCESS('\n=== All seeding complete! ==='))
        self.stdout.write(
            'Tip: Run this after every fresh deployment with:\n'
            '  python manage.py seed_all\n'
        )
