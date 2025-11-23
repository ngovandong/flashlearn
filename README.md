# FlashLearn

FlashLearn is a web application built with Django (Backend) and React (Frontend).

## Tech Stack

- **Backend**: Django, Django Rest Framework (DRF), MySQL, Redis, Elasticsearch
- **Frontend**: React, Material UI, Redux Toolkit
- **Infrastructure**: Docker (implied by Dockerfile)

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL
- Redis

### Backend Setup

1.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt # If available, otherwise check pyproject.toml
    # or
    pip install .
    ```
3.  Set up environment variables (copy `.env.sample` to `.env`).
4.  Run migrations:
    ```bash
    python manage.py migrate
    ```
5.  Start the server:
    ```bash
    python manage.py runserver
    ```

### Frontend Setup

1.  Navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm start
    ```

## Testing

Run backend tests:

```bash
python manage.py test backend.tests
```
