FROM python:3.12-slim

WORKDIR /app

# Install g++ (C++ compiler), curl, then Node.js via official NodeSource setup
# This avoids the Debian 'npm' package which drags in 400+ unnecessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ make ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .

RUN useradd -m runner
USER runner

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
