# GitView

A full-stack application for viewing a team's git activity (commits, file changes, pull requests) per course and repository. Built with **React, Express, Node.js, and PostgreSQL**, using **Prisma Next** to access the database and **Auth0** for login.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, Auth0 (`@auth0/auth0-react`)
- **Backend:** Node.js, Express, TypeScript, Prisma Next (`@prisma/orm-postgres`)
- **Database:** PostgreSQL 15 or newer

## Prerequisites

Install the following before getting started:

- [Node.js](https://nodejs.org/) 22 or newer, and npm
- [Git](https://git-scm.com/) (the backend also uses it to clone repositories for analysis)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another working Docker engine) to run PostgreSQL locally
- An [Auth0](https://auth0.com/) tenant (see [Authentication](#authentication))

## 1. Clone the Repository

```bash
git clone https://github.com/gitview-mqp-2026/gitview.git
cd gitview
```

The project is organized as follows:

```text
gitview/
├── frontend/              # React + Vite frontend
│   └── src/
│       ├── pages/
│       └── components/
└── backend/               # Express + Prisma Next backend
    ├── migrations/        # On-disk database migrations
    ├── .repos/            # Bare clones of analyzed repos (generated, gitignored)
    └── src/
        ├── index.ts       # API routes
        ├── lib/           # Analysis, ingestion, and stats logic
        ├── scripts/       # CLI scripts (e.g. ingest-git-log.ts)
        └── prisma/
            └── contract.prisma
```

## 2. Install Dependencies

From the repository root:

```bash
cd backend
npm install
cd ../frontend
npm install
cd ..
```

> `frontend` and `backend` each have their own `package.json`. There is nothing to install at the repository root.

## 3. Start PostgreSQL

The following command starts a PostgreSQL 17 container for local development:

```bash
docker run --name gitview-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gitview \
  -p 127.0.0.1:5432:5432 \
  -v gitview-postgres-data:/var/lib/postgresql/data \
  -d postgres:17
```

If you've created this container before, start it instead:

```bash
docker start gitview-postgres
```

> The username and password above are **development-only examples**. Do not use them for a public database. If port 5432 is already occupied, change the left side of the port mapping (for example `5433:5432`) and update `DATABASE_URL` below.

## 4. Configure Environment Variables

Copy the example file and edit it:

```bash
cp backend/.env.example backend/.env
```

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gitview"

# Public Auth0 SPA configuration (see Authentication below)
VITE_AUTH0_DOMAIN="your-tenant.us.auth0.com"
VITE_AUTH0_CLIENT_ID="your-auth0-spa-client-id"
```

There is a **single** `.env` file, at `backend/.env`. The backend reads `DATABASE_URL` from it, and Vite is configured to load the `VITE_` values from the same directory, so there is no `frontend/.env`. Optionally set `PORT` there to change the API port (default `3001`).

**Never commit `.env` files or credentials to Git.** Only variables prefixed with `VITE_` are exposed to the browser, so never put secrets in them.

## 5. Set Up the Database

From the `backend` directory, with PostgreSQL running:

```bash
cd backend
npx prisma db init
```

This creates every table declared in the data contract ([`backend/src/prisma/contract.prisma`](backend/src/prisma/contract.prisma)) and signs the database with it so the app can query it. It reads the connection string from `DATABASE_URL` in `backend/.env`.

> **Note:** `npx prisma db migrate` (replaying `backend/migrations/`) currently fails on an empty database, because the `add_course` migration references a table the baseline migration doesn't create. Use `db init` for a fresh local database.

To confirm the database matches the contract:

```bash
npx prisma db verify
```

## 6. Run the Application

Open two terminals from the repository root.

**Terminal 1: Backend**

```bash
cd backend
npm run dev
```

Expected API URL: `http://localhost:3001`.

**Terminal 2: Frontend**

```bash
cd frontend
npm run dev
```

Open the URL displayed by Vite, typically `http://localhost:5173`. The frontend calls the API with relative URLs such as `/courses` and `/repositories`, and Vite proxies those paths to `http://localhost:3001` (see [`frontend/vite.config.js`](frontend/vite.config.js)). If you change the backend `PORT`, update the proxy target as well.

To check the backend directly, visit:

```text
http://localhost:3001/repositories
```

If your database is empty, the endpoint should return `[]`.

## Authentication

The React frontend uses Auth0 Universal Login. Visitors are sent to the public
`/login` page before they can access `/` or `/team`; after authentication they
return to the protected page they originally requested.

1. In Auth0, create an application with the **Single Page Application** type.
2. In that application's settings, add `http://localhost:5173` to:
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins
3. Copy the application's domain and client ID into `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` in `backend/.env`. Do not add an Auth0 client secret to a `VITE_` variable because those values are included in the browser bundle.
4. Restart `npm run dev` in `frontend` after changing `.env`.

For a deployed environment, add its origin (for example,
`https://gitview.example.com`) to the same three Auth0 settings and provide
`VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` in the build environment.

Auth0 must have database sign-ups enabled for the **Create an account** action
to work. If the application is invite-only, remove that button or disable
sign-ups in Auth0.

## Loading Repository Data

Repositories can be added in two ways. Both store the same canonical repository URL, so they land on one `Repository` row.

- **In the app:** use the **Analyze Repo** flow. The backend makes a bare clone of the public repository into `backend/.repos/`, then ingests its commit log.
- **From the command line:** ingest a local clone's git log:

  ```bash
  cd backend
  npm run ingest -- --repo-path /path/to/local/repo [--repo-name <name>]
  ```

## Common Problems

| Problem | What to check |
| --- | --- |
| `ECONNREFUSED` or database connection failed | Make sure the PostgreSQL container is running and that `DATABASE_URL` in `backend/.env` matches its port and credentials. |
| `prisma db migrate` fails with `relation "public.course" does not exist` | Known issue on an empty database. Use `npx prisma db init` instead (see step 5). |
| Queries fail because the database isn't signed/doesn't match the contract | Run `npx prisma db verify` from `backend/`, then `npx prisma db init` (or `npx prisma db update` for an existing database). |
| Type errors or missing models after editing `contract.prisma` | Run `npm run contract:emit` from `backend/` to regenerate `contract.json` and `contract.d.ts`. |
| Frontend network error / API requests (`/courses`, `/repositories`, ...) fail | Confirm the backend is running on port 3001 (the Vite proxy target). Restart Vite after editing `.env`. |
| Blank page or Auth0 configuration error | Confirm `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` are set in `backend/.env` and that `http://localhost:5173` is in all three Auth0 URL settings. |
| "Couldn't clone that repository" when analyzing | The repository must be public, and `git` must be installed and on your `PATH`. |
| `npm run dev` fails | Confirm dependencies were installed in the correct directory (`backend` and `frontend`). |

## Development Notes

- Make data model changes in [`backend/src/prisma/contract.prisma`](backend/src/prisma/contract.prisma), then run `npm run contract:emit` from `backend/`.
- Commit the regenerated `contract.json` and `contract.d.ts` along with the contract change.
- Keep database credentials and other secrets out of source control.
- AWS deployment is not required for local development.
