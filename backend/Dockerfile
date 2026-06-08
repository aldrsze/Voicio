FROM python:3.12-slim AS builder

WORKDIR /build

# Install build deps (including piper-phonemize build chain if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt


# ── Runtime image ─────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# Runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built wheels
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links /wheels -r requirements.txt \
    && rm -rf /wheels

# Copy application code
COPY ./app /app/app
COPY ./models /app/models

EXPOSE 8000

# Run with uvicorn — one worker per container (scale via Docker Compose)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
