FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY apps/api /app/apps/api
COPY data /app/data

RUN pip install --no-cache-dir /app/apps/api

WORKDIR /app/apps/api

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.scripts.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
