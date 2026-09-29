# GitView

## Frontend authentication

The React frontend uses Auth0 Universal Login. Visitors are sent to the public
`/login` page before they can access `/` or `/team`; after authentication they
return to the protected page they originally requested.

1. In Auth0, create an application with the **Single Page Application** type.
2. In that application's settings, add `http://localhost:5173` to:
   - Allowed Callback URLs
   - Allowed Logout URLs
   - Allowed Web Origins
3. Copy `backend/.env.example` to `backend/.env` and add the Auth0 domain and
   client ID there. Vite is configured to load the `VITE_` values from the
   backend environment directory. Do not add an Auth0 client secret to a
   `VITE_` variable because those values are included in the browser bundle.
4. From `frontend`, run `npm install` and `npm run dev`.

For a deployed environment, add its origin (for example,
`https://gitview.example.com`) to the same three Auth0 settings and provide
`VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` in the build environment. For
local development, both values live in `backend/.env` alongside the backend's
server-only variables; only the `VITE_`-prefixed values are exposed to the
frontend.

Auth0 must have database sign-ups enabled for the **Create an account** action
to work. If the application is invite-only, remove that button or disable
sign-ups in Auth0.
