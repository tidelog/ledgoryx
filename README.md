# Ledgoryx

Open-source, self-hosted financial reconciliation software.

Ledgoryx helps businesses identify, investigate, and explain discrepancies between payment records and bank settlements.

## Project Status

Early development.

## Initial Features

- CSV transaction imports
- Deterministic reconciliation engine
- Explainable discrepancy detection
- Financial reconciliation dashboard
- Reconciliation report exports

## Architecture

Ledgoryx is designed for self-hosted deployment.

Customer financial records remain within infrastructure controlled by the customer.

The reconciliation engine is designed to operate independently from the application interface.

## Technology

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL (planned)
- Drizzle ORM (planned)
- Vitest (planned)
- Docker Compose (planned)

## Development

Install dependencies:

npm install

Start the development server:

npm run dev

## Roadmap

1. Application foundation
2. Financial data models
3. CSV import and validation
4. Deterministic reconciliation engine
5. Discrepancy explanations
6. Dashboard
7. Report exports
8. Self-hosted deployment
9. Public open-source release

## License

Open-source license selection pending.

## Self-hosting with Docker

Ledgoryx supports self-hosting with Docker and Docker Compose.

### Requirements

- Docker Engine or Docker Desktop
- Docker Compose

### Start

Run:

```bash
docker compose up -d --build
```

Open http://localhost:3187 in your browser.

The default configuration makes the application accessible only
from the Docker host.

### Check status

```bash
docker compose ps
```

### View logs

```bash
docker compose logs -f
```

### Stop

```bash
docker compose down
```

### Update

After obtaining the latest source code:

```bash
docker compose up -d --build
```

### Data privacy

Ledgoryx processes imported payment and settlement CSV files in the
browser. The current application does not require a database or an API
for uploading financial transaction files.

Users are responsible for securing their devices, browsers, downloaded
reports, and deployment infrastructure.

### Container security

The production container runs as a non-root user, uses a read-only root
filesystem, drops Linux capabilities, and prevents privilege escalation.

The application includes an HTTP health check.

### Network security

The default deployment binds to 127.0.0.1:3187.

For network access, configure a trusted reverse proxy with HTTPS and
appropriate authentication or network access controls.

Do not expose financial investigation interfaces directly to the public
internet without suitable safeguards.
