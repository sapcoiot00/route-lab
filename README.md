# API Workbench

A lightweight Postman-inspired API client built with React, Vite, Tailwind CSS, and an Express proxy.

## Features

- Send HTTP requests through a local proxy to avoid browser CORS limits.
- Save requests into collections and search across saved requests.
- Sign in with Google OAuth and create shared API projects.
- Invite teammates by email as project editors.
- Manage environment variables and use `{{variable}}` syntax in URLs, headers, and bodies.
- View response body, headers, timing, status, and response size.
- Search and copy response payloads.
- Generate local cURL, Fetch, Axios, Python, and Go snippets instantly.
- Optional Gemini-powered helpers for JSON payloads, response explanations, and test suggestions.
- Export the workspace as JSON.

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Optional: create an `.env` file with a Gemini key for AI helpers:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```

3. Optional: add Google OAuth credentials for account onboarding and projects:
   ```bash
   APP_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

   Add this authorized redirect URI in Google Cloud Console:
   ```text
   http://localhost:3000/api/auth/google/callback
   ```

4. Start the app:
   ```bash
   npm run dev
   ```

5. Open:
   ```text
   http://localhost:3000
   ```

## Scripts

- `npm run dev` starts the Express and Vite development server.
- `npm run build` builds the frontend and bundles the server.
- `npm run start` runs the production server from `dist`.
- `npm run lint` runs TypeScript validation.
