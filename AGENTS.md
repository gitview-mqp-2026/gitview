# AGENTS.md

These instructions apply to the entire repository.

## Working principles

- Make small, incremental changes that directly serve the requested task. Avoid unrelated cleanup, broad rewrites, speculative abstractions, or new dependencies without a concrete need.
- Read the affected code and reuse existing components, utilities, naming, and patterns before adding anything new.
- Preserve authentication, backend behavior, database behavior, API contracts and integrations, routing, and business logic unless the task explicitly requires changing them.
- Never discard or overwrite unrelated working-tree changes. Report what changed, what checks ran, and anything that could not be verified.

## Project structure and conventions

- `frontend/` is a React 19 and Vite 8 application written in JavaScript/JSX. Continue using the existing architecture and conventions rather than introducing a second framework or application structure.
- Routing is declared with React Router in `frontend/src/App.jsx`; `frontend/src/main.jsx` supplies `BrowserRouter` and the Auth0 provider. Protected pages use `frontend/src/components/auth/ProtectedRoute.jsx`. Keep those boundaries intact.
- Pages live in `frontend/src/pages/`, shared UI lives in `frontend/src/components/`, authentication UI lives in `frontend/src/components/auth/`, and small frontend helpers live in `frontend/src/utils/`.
- Frontend requests currently use relative `fetch` URLs. Vite proxies the configured API paths to the Express backend on `http://localhost:3001`. Do not replace this behavior or hard-code a different API origin without an explicit requirement.
- Vite loads `VITE_` variables from `backend/.env` through `envDir`. Never expose secrets in `VITE_` variables or commit environment files.
- `backend/` is an Express and TypeScript application. Database contract changes belong in `backend/src/prisma/contract.prisma` and require the existing contract-generation workflow.
- Use npm; `frontend/` and `backend/` have separate `package.json` and lockfiles. The repository-root package has no scripts, so run commands from the relevant subproject.

## Frontend components and styling

- Prioritize shadcn/ui for new or substantially reworked generic controls such as buttons, dialogs, forms, menus, tabs, tables, and feedback states. Do not migrate working components merely for consistency unless the requested task calls for it.
- Before creating a generic UI component, use the shadcn MCP server to search the registry and inspect the closest component and usage examples. If a shadcn MCP server is not exposed in the current session, say so explicitly and do not claim that discovery occurred.
- This repository does not currently contain `components.json` or `frontend/src/components/ui/`; do not assume shadcn/ui is installed or configured. Add or configure it only when the requested UI work needs it, following the project's JavaScript/Vite/Tailwind setup and keeping the change scoped.
- Tailwind CSS v4 is enabled by `@tailwindcss/vite` and imported from `frontend/src/index.css`. Existing screens predominantly use semantic class names in `frontend/src/App.css`, with component-specific CSS such as `frontend/src/components/AddCourseForm.css`. Reuse the nearest established approach and avoid creating a competing styling system.
- Use `lucide-react`, which is already installed, for interface icons instead of adding another icon package.
- Aim for a polished, professional, modern application. Keep typography, spacing, colors, alignment, states, density, and visual hierarchy consistent across the affected experience.
- Prefer restrained, purposeful styling. Avoid unnecessary gradients, excessive shadows or glow, gratuitous animation, and one-off component treatments that conflict with surrounding UI.
- Refactor duplicated UI or tangled code when it is necessary to make the requested change clear and maintainable, but do not rewrite unrelated components.

## UI/UX improvement workflow

- Reuse existing React components and shadcn/ui primitives whenever possible. Before implementing a new UI pattern, use shadcn MCP to discover and inspect the closest suitable components and examples.
- Before making visual changes, use Playwright MCP to inspect the rendered affected pages and capture a baseline. Afterward, revisit them to verify the result and affected interactions.
- Maintain consistent typography, spacing, colors, border radii, shadows, alignment, hierarchy, and responsive behavior across the affected experience.
- Use existing theme tokens instead of arbitrary hardcoded styling. If a required reusable token is missing, add the smallest central token that fits the existing styling system.
- Prioritize accessibility, clear navigation, intuitive interactions, readable layouts, semantic structure, keyboard operation, and visible focus feedback.
- Include relevant loading, error, empty, success, hover, focus, and disabled states. Do not add states that the interaction cannot reach.
- Avoid unnecessary dependencies, excessive animation, speculative abstractions, and large unrelated refactors.
- Preserve backend logic, authentication flows, API contracts, and data handling unless the task explicitly requires a coordinated change.
- Run the existing checks that cover the affected functionality. Use Playwright MCP to visually verify affected pages at representative desktop and mobile widths.
- Report blockers and unverified states truthfully. Never claim a page, interaction, viewport, authentication flow, or integration was tested when it was not.

## Responsive design and accessibility

- Make affected pages work at mobile, tablet, and desktop widths. Check wrapping, overflow, touch targets, navigation, dialogs, forms, tables, and dense data views rather than only shrinking the desktop layout.
- Use semantic HTML and native controls where appropriate. Associate labels and inputs, provide meaningful accessible names for icon-only controls, preserve logical heading order, and expose status and error feedback to assistive technology.
- Preserve keyboard navigation and visible focus. Avoid mouse-only interactions; make overlays, menus, and dialogs operable and dismissible by keyboard when applicable.
- Respect reduced-motion preferences and provide clear loading, empty, success, disabled, and error states when the interaction needs them.

## Playwright MCP workflow for UI changes

- Use Playwright MCP to inspect every affected page before editing so the change is grounded in the current rendered UI.
- After editing, use Playwright MCP to revisit the affected pages, capture screenshots, exercise the changed interactions, and inspect relevant console or network errors.
- Check representative mobile, tablet, and desktop viewport sizes with Playwright MCP. Include authenticated or protected states when credentials and test data are available; otherwise report the exact state that could not be verified.
- Prefer accessibility snapshots for locating and understanding controls, while still using screenshots for visual review.
- A documentation-only or non-UI change does not require launching the application or taking screenshots.

## Verification

Run the smallest relevant set of existing checks from the appropriate directory. Do not invent lint, type-check, or test scripts that are not present.

### Frontend (`frontend/`)

```powershell
npm run dev
npm test
npm run build
npm run preview
```

- `npm test` runs the current Node test for `src/utils/fileLabels.test.js`.
- For UI/UX work, a successful build is not enough: complete the Playwright MCP inspection above.

### Backend (`backend/`)

```powershell
npm run dev
npm test
npm run contract:emit
npm run ingest -- --repo-path <path> [--repo-name <name>]
npx prisma db verify
```

- Run `npm run contract:emit` only when the Prisma contract changes, and commit the regenerated contract artifacts with that change.
- Use `npx prisma db init` for a fresh local database as documented in `README.md`; the migration path has a documented empty-database limitation.
- Backend and database commands may require PostgreSQL, environment configuration, Git, or repository data. Report missing prerequisites instead of masking failures.

## Completion report

- Summarize the user-visible and structural changes.
- List the checks and Playwright MCP coverage actually completed, including viewports and interactions when relevant.
- State anything not run or not verified and the remaining risk. Do not imply that authentication, data-dependent flows, responsive layouts, or backend integration were checked when they were not.
