FROM python:3.11-slim

# Install security tools and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    nmap \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# NOTE: amass and masscan are not available in Debian's default repos for this
# slim base. The application already falls back gracefully when these tools
# are absent. They can be added later via separate images or copying static
# binaries into the container if truly required.

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Default command (can be overridden)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

