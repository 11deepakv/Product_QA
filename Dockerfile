# Use official Python slim image
FROM python:3.11.2-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file first for better caching
COPY requirements.txt .

# Install pip and Python packages
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
# Ensure FastAPI and Uvicorn are installed (in case requirements.txt doesnâ€™t have them)
RUN pip install --no-cache-dir fastapi uvicorn

# Copy backend and frontend code
# COPY backend/ ./backend/
# COPY frontend/ ./frontend/

COPY . .

# Expose the port for Cloud Run or local use
EXPOSE 8080

# Start FastAPI app using uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]