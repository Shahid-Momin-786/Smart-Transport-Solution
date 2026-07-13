# Smart Transport Solution (SMTS)

A comprehensive, full-stack Smart Transport Solution designed to streamline transport management, route tracking, and ticketing. 

## 🚀 Features

- **Dynamic Stage-Based Ticketing:** Real-time dynamic ticket fare calculation based on selected boarding and drop-off stops.
- **Live Bus Timings & ETA:** Real-time Expected Time of Arrival (ETA) calculation, schedule delay management, and dynamic bus status tracking.
- **Interactive Maps & Routing:** Integrated Leaflet maps for route visualization and transport tracking.
- **Responsive Passenger Portal:** A mobile-first passenger dashboard to seamlessly manage daily passes, ticket booking, and upcoming journeys.
- **Analytics Dashboard:** Comprehensive statistics and data visualization using Recharts.
- **QR Code Ticketing & Passes:** Generate and manage QR codes for seamless ticketing and verification.
- **Export & Reporting:** Export data, reports, and tickets in PDF and Excel formats.
- **Secure Authentication:** JWT-based secure authentication and role-based access control.
- **Modern UI/UX:** Fully responsive design built with Tailwind CSS, featuring smooth micro-animations with Framer Motion.
- **Robust Form Validation:** Client-side validation using React Hook Form and Zod.

## 🛠 Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS 4
- **State Management & Data Fetching:** React Query (TanStack Query), Axios
- **Form Handling:** React Hook Form + Zod validation
- **Maps:** Leaflet & React-Leaflet
- **Data Visualization:** Recharts
- **Animations:** Framer Motion
- **Utilities:** date-fns, html2canvas, jsPDF, qrcode, react-hot-toast

### Backend
- **Framework:** Django 5 & Django REST Framework
- **Authentication:** SimpleJWT (JSON Web Tokens)
- **Database:** SQLite (Default for development)
- **File Processing:** Pillow (Images), ReportLab (PDFs), OpenPyXL (Excel), qrcode
- **Security & APIs:** django-cors-headers, django-ratelimit, django-filter
- **Production Ready:** Gunicorn, Whitenoise (Static file serving)

## 📂 Project Structure

```text
SMTS/
├── backend/            # Django REST API & backend logic
│   ├── core/           # Main Django app / settings
│   ├── apps/           # Django apps (e.g., users, routes, tickets)
│   ├── media/          # Uploaded media files
│   ├── manage.py
│   └── requirements.txt
└── frontend/           # React frontend application
    ├── public/         # Static assets
    ├── src/            # React components, pages, hooks, services
    ├── index.html
    └── package.json
```

## 🚦 Getting Started

### Prerequisites

- [Python 3.10+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/) & npm

### Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   Create a `.env` file in the `backend/` directory (you can use the open `.env` file as reference) with necessary configurations (e.g., `SECRET_KEY`, `DEBUG`).
5. Run database migrations:
   ```bash
   python manage.py migrate
   ```
6. Start the Django development server:
   ```bash
   python manage.py runserver
   ```
   The backend API will be available at `http://127.0.0.1:8000/`.

7. **Seed the Database (Optional):** Generate realistic test data using the custom management commands:
   ```bash
   python manage.py seed_all    # Seeds Depots, Buses, and Users
   python manage.py seed_stops  # Seeds Routes and Stops with distances
   python manage.py seed_trips  # Seeds daily trip schedules
   ```

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required npm packages:
   ```bash
   npm install
   ```
3. Configure environment variables:
   Create a `.env` file in the `frontend/` directory (e.g., `VITE_API_BASE_URL=http://127.0.0.1:8000`).
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173/`.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🛡️ License

This project is licensed under the MIT License.
