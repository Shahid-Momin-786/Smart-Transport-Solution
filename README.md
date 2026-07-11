# Smart Transport Solution

A comprehensive full-stack Smart Transport Solution.

## Tech Stack

- **Backend:** Django (Python)
- **Frontend:** React + Vite, Tailwind CSS
- **Database:** SQLite (Default for development)

## Project Structure

- `backend/`: Django REST Framework API and backend logic.
- `frontend/`: React application built with Vite and styled with Tailwind CSS.

## Getting Started

### Prerequisites

- [Python 3.x](https://www.python.org/)
- [Node.js](https://nodejs.org/) & npm

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
4. Run database migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the Django development server:
   ```bash
   python manage.py runserver
   ```
   The backend will typically be available at `http://127.0.0.1:8000/`.

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will typically be available at `http://localhost:5173/`.

## Environment Variables

> **Note:** Ensure you configure your `.env` files appropriately for both the backend and frontend if required by the application logic. (An example or template can be found in the respective directories if applicable).
