# Deploying the realtime service (Google Cloud Run)

The web app runs on Firebase App Hosting (which is Cloud Run underneath). The realtime service (WebSockets for terminals and dashboards) is a **second Cloud Run service in the same Google Cloud project**, with its own address. Terminals and dashboards connect to it directly, not through Firebase Hosting.

## Current deployment
* Project `e-commerce-8000c`, region **me-central1** (Doha), service `lumia-order-realtime`, image `me-central1-docker.pkg.dev/e-commerce-8000c/lumia/realtime:latest`.
* Address for now: `https://lumia-order-realtime-445206340283.me-central1.run.app` (use `wss://` for sockets). The web app uses this address directly (`REALTIME_URL` in `apphosting.yaml`). **Later, optional:** map `realtime.order.lumia.ae` (step 3), then switch `REALTIME_URL` back and redeploy; terminals paired earlier keep working with the old address until they pair again.
* Runs with min 1 / max 5 instances, concurrency 1000, timeout 3600 s; secrets `lumia-order-database-url` and `lumia-order-auth-secret` (the Compute service account was given read access to those two secrets only).
* Update after code changes: rerun the build and `gcloud run deploy` of step 2.

Replace `PROJECT` and `REGION` (pick the one closest to the UAE that you use for App Hosting).

## 1. One-time
```bash
gcloud config set project PROJECT
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
```
The secrets already exist from App Hosting (`lumia-order-database-url`, `lumia-order-auth-secret`). The service account that runs the service needs the *Secret Manager Secret Accessor* role on both.

## 2. Build and deploy (from the repo root)
```bash
gcloud artifacts repositories create lumia --repository-format=docker --location=REGION   # once
gcloud builds submit apps/admin --config=- <<'EOF'
steps:
- name: gcr.io/cloud-builders/docker
  args: ['build','-f','Dockerfile.realtime','-t','REGION-docker.pkg.dev/PROJECT/lumia/realtime:latest','.']
images: ['REGION-docker.pkg.dev/PROJECT/lumia/realtime:latest']
EOF
gcloud run deploy lumia-order-realtime --image REGION-docker.pkg.dev/PROJECT/lumia/realtime:latest --region REGION \
  --allow-unauthenticated --concurrency 1000 --timeout 3600 --min-instances 1 --max-instances 5 --cpu 1 --memory 512Mi \
  --set-secrets DATABASE_URL=lumia-order-database-url:latest,BETTER_AUTH_SECRET=lumia-order-auth-secret:latest
```
`--allow-unauthenticated` is right: terminals and dashboards authenticate with their own key or ticket inside the connection.

## 3. Address
Map a domain to the service, then point DNS at it as Cloud Run shows:
```bash
gcloud beta run domain-mappings create --service lumia-order-realtime --domain realtime.order.lumia.ae --region REGION
```
Then set `REALTIME_URL` in `apps/admin/apphosting.yaml` to `wss://realtime.order.lumia.ae` and redeploy the web app. (Domain mappings may not be offered in every region: if the command refuses for me-central1, use a load balancer in front, or another region. Your domain's DNS is at Marcaria, name servers ns01.dns.nexus: the CNAME is added there. Verify `lumia.ae` in Google Search Console first.)

## 4. Check
`curl https://realtime.order.lumia.ae/health` answers `{"ok":true,"connections":N}`. Pair a terminal (or `public/terminal-sim.html?rt=wss://realtime.order.lumia.ae/ws/device`) and watch it appear Online in Settings → Devices.

## Notes
* Cloud Run ends a connection after the request timeout (3600 s max): terminals reconnect and replay what they missed, which they already do.
* Database: Atlas must allow the Cloud Run egress (allow `0.0.0.0/0` with a strong password, or use a static egress IP / VPC connector and allow-list it).
* When the number of terminals passes a few thousand, add the change-stream source (see `TERMINAL_PROTOCOL.md`, Scale).
