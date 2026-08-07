# Deploying the backend to a free Oracle Cloud VM

Scope: **backend + Postgres + Redis + MinIO only**, on Oracle Cloud's "Always
Free" tier — genuinely free forever (not a time-limited trial), no domain
required. admin-web/web deployment and adding a domain + HTTPS are follow-ups,
noted at the end.

Two kinds of steps below: **[Console]** — Oracle's web UI, only you can do
this (needs your identity/payment details). **[VM]** — a command you run over
SSH once the VM exists. **[Local]** — a command on your own machine.

## 1. Create an Oracle Cloud account [Console]

1. Go to <https://cloud.oracle.com>, sign up for a free account.
2. Verify your identity — Oracle requires a card for verification even for
   Always Free resources. As long as you stay within the Always Free limits
   (below), you are never charged.
3. Pick a home region during signup. Always Free Ampere A1 capacity is
   sometimes unavailable in a given region — if VM creation fails with an
   "out of capacity" error in step 2, that's the fix (try a different
   Availability Domain first, then a different region if needed).

## 2. Create the VM [Console]

1. Console → **Compute → Instances → Create Instance**.
2. Image: **Ubuntu 22.04**. Shape: click "Change shape" → **Ampere** → **VM.Standard.A1.Flex** → set **4 OCPUs / 24 GB memory** (the full Always Free allowance — no cost either way, might as well take all of it).
3. Under "Add SSH keys", either paste your own public key (`~/.ssh/id_ed25519.pub` or similar) or let Oracle generate a key pair and download the private key — you'll need it to SSH in.
4. Create the instance. Note the **public IP address** shown once it's running — you'll need it constantly from here on (referred to as `<VM_PUBLIC_IP>` below).

## 3. Open the firewall — two separate layers [Console] + [VM]

Oracle blocks everything by default at **two independent layers**. Missing either one means "connection refused"/timeout even though the other is configured correctly — this trips up almost everyone the first time.

**[Console] VCN Security List** — Networking → Virtual Cloud Networks → (your VCN) → Security Lists → Default Security List → Add Ingress Rules. Add three rules, source CIDR `0.0.0.0/0` for each:
- TCP, destination port `22` (SSH — likely already present by default)
- TCP, destination port `3000` (backend API)
- TCP, destination port `9000` (MinIO S3 API — must be public; see `docker-compose.prod.yml`'s comment on why)

**[VM] iptables** — Oracle's Ubuntu image ships with a default-deny iptables ruleset on top of the above. SSH in (see step 4 first if you haven't yet), then:

```sh
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 9000 -j ACCEPT
sudo netfilter-persistent save   # persist across reboots; install if missing: sudo apt install -y iptables-persistent
```

## 4. SSH in and install Docker [VM]

From your own machine:

```sh
ssh -i /path/to/your/private_key ubuntu@<VM_PUBLIC_IP>
```

Then, on the VM:

```sh
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
# log out and back in (or `newgrp docker`) for the group change to apply
```

## 5. Get the code onto the VM [VM]

```sh
git clone <your-repo-url> foodmap
cd foodmap
```

(No repo host yet? `scp -r -i /path/to/your/private_key /local/path/to/map-food-byhoane ubuntu@<VM_PUBLIC_IP>:foodmap` from your own machine works too.)

## 6. Create both `.env` files [VM]

Two separate files, two separate purposes — see the comment at the top of each `*.example` for why:

```sh
cp .env.production.example .env                     # repo root — Docker Compose variable substitution
cp backend/env.production.example backend/.env      # backend container's runtime env
```

Edit both with real values:

```sh
nano .env             # set POSTGRES_PASSWORD, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
nano backend/.env     # set JWT_ACCESS_SECRET, S3_PUBLIC_ENDPOINT, S3_PUBLIC_BASE_URL (both use <VM_PUBLIC_IP>)
```

Generate strong random values instead of typing something by hand:

```sh
openssl rand -hex 32   # for JWT_ACCESS_SECRET
openssl rand -hex 24   # for POSTGRES_PASSWORD / MINIO_ROOT_PASSWORD
```

`backend/.env`'s `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`DATABASE_URL`/`REDIS_URL` don't matter what you put — `docker-compose.prod.yml` overrides all four from the root `.env`'s values automatically, so there's nothing to keep in sync by hand for those specifically.

## 7. Build and start [VM]

```sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps   # all should reach "healthy" within ~30s
```

Run migrations and reference-data seeds (one-time, and after any future migration). The container's `WORKDIR` is `/app` (the monorepo root, needed for the shared-types symlink), but `prisma`/`npm run seed` expect to run from `backend/` — pass `--schema` for the former and `-w /app/backend` for the latter:

```sh
docker compose exec backend npx prisma migrate deploy --schema=backend/prisma/schema.prisma
docker compose exec -w /app/backend backend npm run seed
docker compose exec -w /app/backend backend npx ts-node prisma/seed-restaurants.ts   # optional demo dataset
docker compose exec -w /app/backend backend npx ts-node prisma/seed-reviews.ts       # optional demo dataset
```

## 8. Verify [Local]

```sh
curl http://<VM_PUBLIC_IP>:3000/health
# expect: {"status":"ok","db":true,"redis":true}
```

Point the mobile app / admin-web at `http://<VM_PUBLIC_IP>:3000` (their existing `EXPO_PUBLIC_API_URL`/`VITE_API_URL`-style env vars) to confirm end-to-end.

## Debugging

```sh
docker compose logs -f backend      # backend app logs
docker compose logs -f postgres     # if migrate/seed fails
docker compose exec backend sh      # shell inside the running container
```

## Redeploying after a code change [VM]

No CI/CD this pass — manual redeploy:

```sh
cd foodmap
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
docker compose exec backend npx prisma migrate deploy --schema=backend/prisma/schema.prisma   # only if new migrations exist
```

## Known limitations of this pass (deliberate, follow-ups)

- **No domain, no HTTPS.** Everything above is plain HTTP — fine for a portfolio demo with test data, not for real user data. Once you have a domain, add [Caddy](https://caddyserver.com/) as a reverse proxy in front of the backend (and, once exposed similarly, MinIO) for automatic Let's Encrypt TLS — a natural next step, not covered here.
- **admin-web / web are not deployed by this runbook.** They can point at `http://<VM_PUBLIC_IP>:3000` from wherever you eventually host them (e.g. a static host for the Vite/Next builds).
- **No CI/CD.** Redeploy is the manual `git pull` + rebuild sequence above.
- **Redis has no password**, same as local dev — acceptable since it's internal-only (not published to the host) in `docker-compose.prod.yml`, but worth hardening later if you want defense-in-depth against a container-escape scenario.
