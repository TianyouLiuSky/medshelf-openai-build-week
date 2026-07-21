# Deploy MedShelf On Render

This guide deploys MedShelf as one managed Render web service. You do not need
a VPS, SSH, open ports on your computer, a custom domain, Docker installed
locally, or an OpenAI API key.

The hosted demo uses:

- A Docker image built by Render from this repository.
- FastAPI serving both `/api/*` and the compiled React app.
- SQLite and uploaded leaflet files under `/tmp/medshelf`.
- Browser-side OCR where the visitor's browser supports it.
- `EXTRACTION_PROVIDER=mock`, so the public demo makes no paid API calls.

## Before You Start

1. Push the repository changes to GitHub.
2. Keep `OPENAI_API_KEY` unset in Render.
3. Confirm the root `render.yaml` is present in the default branch.

## Create The Render Service

1. Go to [Render](https://render.com/) and create an account or sign in.
2. Connect your GitHub account when Render asks for repository access.
3. In the Render dashboard, choose **New** and then **Blueprint**.
4. Select `TianyouLiuSky/medshelf-openai-build-week`.
5. Let Render read the root `render.yaml`.
6. Confirm the Blueprint creates one web service named
   `medshelf-openai-build-week`.
7. Create or apply the Blueprint.
8. Watch the build logs. Render should build the frontend during the Docker
   build, install backend Python dependencies, and start FastAPI with the
   Render-provided `PORT`.
9. When deployment finishes, open the generated `https://...onrender.com` URL.

You do not need to configure a custom domain. Render hosts the app and keeps it
online; your laptop can be turned off.

## Verify The Deployment

Open the Render URL in a private or incognito browser window, then check:

1. Visit `/api/health`. It should return JSON with `"status": "ok"`.
2. Visit `/`. The React MedShelf app should load, not just an API message.
3. Confirm the public demo notice is visible.
4. Confirm the seeded medicines appear.
5. Open `Evening Allergy Tablet`, mark a fictional dose as `Taken`, and confirm
   inventory changes.
6. Open the leaflet review sample and confirm the review UI appears.
7. Use `Restore sample data`, confirm the warning, and verify the seeded demo
   state returns.
8. Refresh the dashboard.
9. Open a direct frontend route, such as a medicine page if the browser is on
   one, and refresh. It should not return a 404.

Use only fictional data in the hosted demo.

## Disposable Storage

The free public demo stores SQLite data and uploaded leaflet files under
`/tmp/medshelf`. This is intentionally disposable. Data and uploads may be
erased after a restart, redeploy, or platform maintenance event. The Render
Blueprint enables `RESET_DEMO_DATA_ON_START=true`, so fictional seeded data is
restored whenever the service process starts.

This deployment is not HIPAA-compliant storage and should not receive real
personal, prescription, or medical information.

## Troubleshooting

### Docker Build Fails

- Check the Render build log for the first failing command.
- If the failure is in the frontend stage, confirm `frontend/package-lock.json`
  is committed and `npm run build` passes locally.
- If the failure is in the backend stage, confirm `backend/requirements.txt` is
  committed and `npm run check` passes locally.

### Health Check Fails

- Confirm `healthCheckPath` is `/api/health` in `render.yaml`.
- Confirm the service log shows Uvicorn binding to `0.0.0.0` and the Render
  `PORT`.
- Confirm `APP_ENV`, `DATABASE_URL`, `LEAFLET_UPLOAD_DIR`, and
  `FRONTEND_DIST_DIR` match `render.yaml`.

### Only The API Response Appears

If `/` shows the API running message instead of React, FastAPI did not find the
compiled frontend.

- Confirm the Docker build completed `npm run build`.
- Confirm `FRONTEND_DIST_DIR=/app/frontend/dist`.
- Confirm the Dockerfile copies `/app/frontend/dist` into the runtime image.

### Seeded Data Is Missing

- Confirm `SEED_DEMO_DATA=true`.
- For the public demo, confirm `RESET_DEMO_DATA_ON_START=true`.
- Use the `Restore sample data` button in the UI.

### `/tmp/medshelf` Permission Errors

- Confirm `DATABASE_URL=sqlite:////tmp/medshelf/medshelf.db`.
- Confirm `LEAFLET_UPLOAD_DIR=/tmp/medshelf/uploads/leaflets`.
- Confirm the Dockerfile creates `/tmp/medshelf` and runs the app as the
  `medshelf` user.

### Frontend Requests Point To Localhost

The deployed frontend should use relative `/api` requests. Do not set
`VITE_API_BASE_URL` to `localhost` for the Render build. If API requests fail in
the browser, inspect the Network tab and confirm they target the same
`onrender.com` origin.
