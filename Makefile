.PHONY: dev build docker-up docker-down server-up server-down migrate seed test clean

dev:
	docker compose up --build

build:
	docker compose build

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

server-up:
	docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d

server-down:
	docker compose -f docker-compose.yml -f docker-compose.server.yml down

migrate:
	docker compose run --rm backend prisma db push --schema=/app/src/prisma/schema.prisma

seed:
	docker compose run --rm backend python -m src.prisma.seed

test:
	docker compose run --rm backend pytest
	docker compose run --rm executor pytest

clean:
	docker compose down -v
