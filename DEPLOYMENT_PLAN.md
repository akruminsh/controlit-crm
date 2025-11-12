# Controlit Factory CRM - Deployment & Customization Plan

**Target Domain:** `crm.controlitfactory.eu`
**Platform:** Hostinger VPS
**Date:** 2025-11-12
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Repository Status](#current-repository-status)
3. [Repository Separation Strategy](#repository-separation-strategy)
4. [Hostinger Infrastructure Analysis](#hostinger-infrastructure-analysis)
5. [Deployment Architecture](#deployment-architecture)
6. [Customization Strategy for Controlit Factory](#customization-strategy-for-controlit-factory)
7. [Step-by-Step Deployment Guide](#step-by-step-deployment-guide)
8. [Cost Analysis](#cost-analysis)
9. [Maintenance & Operations](#maintenance--operations)
10. [Risk Assessment & Mitigation](#risk-assessment--mitigation)

---

## Executive Summary

This document provides a comprehensive plan to deploy the Controlit CRM (based on Twenty CRM) on Hostinger VPS infrastructure at `crm.controlitfactory.eu`. The project involves:

- **Separating from the fork** to create an independent repository
- **Customizing** the application for Controlit Factory employees
- **Deploying** to Hostinger VPS with proper infrastructure setup
- **Maintaining** the system for production use

### Key Metrics

| Metric | Value |
|--------|-------|
| **Estimated Setup Time** | 2-3 weeks |
| **Recommended VPS Plan** | Hostinger KVM 4 (4 vCPU, 16GB RAM) |
| **Monthly Cost** | ~$10-15/month |
| **Complexity Level** | Medium-High |
| **Required Skills** | DevOps, Linux, Docker, PostgreSQL |

---

## Current Repository Status

### Repository Information

- **Current Remote:** `akruminsh/controlit-crm`
- **Current Branch:** `claude/audit-repo-separation-011CV4UEhhAqBLP7FfXsxMNn`
- **Origin:** Fork/mirror of Twenty CRM (twentyhq/twenty)
- **License:** AGPL-3.0 (copyleft)
- **Version:** 0.2.1
- **Node.js Version:** 24.5.0+
- **Package Manager:** Yarn 4.9.2

### Repository Structure

```
controlit-crm/
├── packages/
│   ├── twenty-server/       # NestJS backend (GraphQL API)
│   ├── twenty-front/        # React frontend (SPA)
│   ├── twenty-docker/       # Docker configurations
│   ├── twenty-ui/           # Shared UI components
│   ├── twenty-shared/       # Common utilities
│   ├── twenty-emails/       # Email templates
│   └── ... (11 more packages)
├── package.json             # Monorepo root
├── nx.json                  # Nx workspace config
└── tsconfig.base.json       # TypeScript config
```

### Tech Stack

**Backend:**
- NestJS 9.4.3
- TypeORM 0.3.20
- GraphQL Yoga 4.0.5
- PostgreSQL 16
- Redis 6+
- BullMQ (job queue)

**Frontend:**
- React 18.2.0
- Recoil (state management)
- Emotion.js (styling)
- Apollo Client (GraphQL)
- Vite 7.0.0 (bundler)

**Infrastructure:**
- Docker & Docker Compose
- Kubernetes (optional)
- Node.js 24-alpine base images

---

## Repository Separation Strategy

### Why Separate from Fork?

1. **Independence:** Remove dependency on upstream Twenty CRM updates
2. **Customization:** Freedom to customize without merge conflicts
3. **Branding:** Remove all references to "Twenty" and "TwentyHQ"
4. **Ownership:** Establish clear ownership for Controlit Factory

### Separation Steps

#### Option 1: Detach Fork (Recommended)

This creates a completely independent repository while preserving history.

```bash
# 1. Clone the current repository
git clone http://local_proxy@127.0.0.1:24696/git/akruminsh/controlit-crm controlit-crm-new
cd controlit-crm-new

# 2. Create a new empty repository on GitHub/GitLab
# Name: controlit-crm (or controlit-factory-crm)

# 3. Update remote to new repository
git remote remove origin
git remote add origin <new-repository-url>

# 4. Create main branch and push
git checkout -b main
git push -u origin main

# 5. The repository is now independent
```

#### Option 2: Fresh Start with Squashed History

This creates a new repository with a single initial commit.

```bash
# 1. In current repository, create an orphan branch
git checkout --orphan new-main

# 2. Commit everything as initial commit
git add .
git commit -m "Initial commit: Controlit Factory CRM v1.0.0

Based on Twenty CRM, customized for Controlit Factory.
- Removed upstream fork references
- Rebranded for Controlit Factory
- Configured for crm.controlitfactory.eu deployment"

# 3. Push to new repository
git remote set-url origin <new-repository-url>
git push -u origin new-main

# 4. Set as default branch
git branch -m new-main main
git push origin -u main
```

### Post-Separation Actions

1. **Update README.md** - Remove Twenty references, add Controlit branding
2. **Update LICENSE** - Keep AGPL-3.0 but update copyright holder
3. **Update CLAUDE.md** - Replace "Twenty CRM" with "Controlit Factory CRM"
4. **Update package.json** - Change `"name": "twenty"` to `"name": "controlit-crm"`
5. **Create CHANGELOG.md** - Document changes from Twenty CRM base

---

## Hostinger Infrastructure Analysis

### Hostinger VPS Capabilities

✅ **Supported:**
- Full root access (required for Node.js, PostgreSQL, Redis)
- Node.js 24+ installation
- PostgreSQL 16 installation
- Redis installation
- Docker & Docker Compose
- Custom domains and subdomains
- SSL certificates (Let's Encrypt)
- SSH access
- DDoS protection
- NVMe SSD storage

❌ **Not Supported (requires workarounds):**
- Managed PostgreSQL (must self-host)
- Managed Redis (must self-host)
- Built-in load balancing (single server)
- Auto-scaling
- Kubernetes (can install but resource-constrained)

### Recommended VPS Plan

Based on requirements analysis:

| Plan | vCPU | RAM | Storage | Bandwidth | Price | Recommendation |
|------|------|-----|---------|-----------|-------|----------------|
| **KVM 1** | 1 | 4GB | 50GB | 4TB | $4.99/mo | ❌ Too small for build |
| **KVM 2** | 2 | 8GB | 100GB | 8TB | ~$7/mo | ⚠️ Minimum viable |
| **KVM 4** | 4 | 16GB | 200GB | - | ~$12/mo | ✅ **Recommended** |
| **KVM 8** | 8 | 32GB | 400GB | 32TB | $19.99/mo | ⭐ Ideal for growth |

**Recommendation:** Start with **KVM 4** (16GB RAM) for the following reasons:

1. **Build Requirements:** Frontend build requires 8GB Node.js heap space
2. **Runtime Memory:** Server (512MB-1GB) + Worker (1-2GB) + PostgreSQL (2GB) + Redis (512MB) = ~4-5GB
3. **Headroom:** 16GB provides comfortable buffer for peaks and additional services
4. **Cost-Effective:** ~$12/mo is reasonable for a business CRM

**Alternative Strategy (Cost-Optimized):**
- Build on local machine or CI/CD (GitHub Actions)
- Deploy pre-built Docker images to **KVM 2** (8GB RAM)
- This reduces cost to ~$7/mo but requires external build infrastructure

---

## Deployment Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  crm.controlitfactory.eu                    │
│                     (Domain DNS)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Hostinger VPS (KVM 4)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Nginx Reverse Proxy                       │   │
│  │        (SSL Termination, Port 80/443)                │   │
│  └────────┬─────────────────────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────────────┐  │
│  │         Docker Compose Stack                          │  │
│  │  ┌─────────────────┐  ┌─────────────────┐            │  │
│  │  │  CRM Server     │  │  CRM Worker     │            │  │
│  │  │  (Port 3000)    │  │  (Background)   │            │  │
│  │  │  NestJS/GraphQL │  │  BullMQ Jobs    │            │  │
│  │  └────────┬────────┘  └────────┬────────┘            │  │
│  │           │                     │                      │  │
│  │           ├─────────────────────┤                      │  │
│  │           │                     │                      │  │
│  │  ┌────────▼────────┐   ┌───────▼────────┐            │  │
│  │  │  PostgreSQL 16  │   │     Redis      │            │  │
│  │  │  (Port 5432)    │   │  (Port 6379)   │            │  │
│  │  │  Main Database  │   │  Cache & Queue │            │  │
│  │  └─────────────────┘   └────────────────┘            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Volumes (Persistent Storage):                              │
│  - /var/lib/postgresql/data (database)                      │
│  - /app/.local-storage (uploaded files)                     │
└──────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Nginx Reverse Proxy

**Purpose:** SSL termination, static file serving, reverse proxy to Node.js

**Configuration:**
```nginx
server {
    listen 80;
    server_name crm.controlitfactory.eu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.controlitfactory.eu;

    ssl_certificate /etc/letsencrypt/live/crm.controlitfactory.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.controlitfactory.eu/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support for GraphQL subscriptions
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # File upload size limit
    client_max_body_size 100M;
}
```

#### 2. Docker Compose Stack

**Services:**
- `server`: Main application (NestJS backend + React frontend)
- `worker`: Background job processor
- `db`: PostgreSQL 16 database
- `redis`: Redis cache and job queue

**Resource Allocation:**
- Server: 1-2GB RAM, 1 CPU
- Worker: 1-2GB RAM, 1 CPU
- PostgreSQL: 2-4GB RAM, 1 CPU
- Redis: 512MB RAM, 0.5 CPU

#### 3. Storage Strategy

**Database Storage:**
- Location: Docker volume `db-data` → `/var/lib/postgresql/data`
- Backup: Daily automated backups to external storage

**File Storage:**
- Default: Local storage in Docker volume `server-local-data`
- Optional: AWS S3 for production (recommended for scalability)

**Log Storage:**
- Application logs: `/var/log/controlit-crm/`
- Docker logs: `docker logs <container>`
- Nginx logs: `/var/log/nginx/`

### Networking

**External Access:**
- Port 80 (HTTP) → Nginx → Redirect to HTTPS
- Port 443 (HTTPS) → Nginx → Proxy to :3000

**Internal (Docker Network):**
- Server → PostgreSQL (db:5432)
- Server → Redis (redis:6379)
- Worker → PostgreSQL (db:5432)
- Worker → Redis (redis:6379)

**Firewall Rules (UFW):**
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

---

## Customization Strategy for Controlit Factory

### Priority 1: Critical Branding Changes

These changes are **required** before deployment to remove Twenty references:

#### 1.1 Docker Images & Registry

**Files to Update:**

```yaml
# packages/twenty-docker/docker-compose.yml
services:
  server:
    image: controlitfactory/crm:${TAG:-latest}  # Changed from twentycrm/twenty
  worker:
    image: controlitfactory/crm:${TAG:-latest}
  db:
    image: controlitfactory/crm-postgres:latest  # Changed from twentycrm/twenty-postgres
```

**Action Items:**
- [ ] Create Docker Hub account: `controlitfactory`
- [ ] Build and push custom images
- [ ] Update all references in docker-compose.yml, render.yaml, K8s manifests

#### 1.2 Email Configuration

**File:** `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`

**Changes:**
```typescript
// Line ~320
EMAIL_FROM_NAME: {
  type: ConfigVariableType.String,
  default: 'Controlit Factory CRM',  // Changed from 'Felix from Twenty'
},

EMAIL_FROM_ADDRESS: {
  type: ConfigVariableType.String,
  default: 'noreply@controlitfactory.eu',  // Changed from yourdomain.com
},

EMAIL_SYSTEM_ADDRESS: {
  type: ConfigVariableType.String,
  default: 'system@controlitfactory.eu',
},
```

#### 1.3 Application Branding

**Files to Update:**

1. **Root package.json:**
   ```json
   {
     "name": "controlit-crm",  // Changed from "twenty"
     "version": "1.0.0",
     "license": "AGPL-3.0"
   }
   ```

2. **Frontend Metadata:** `packages/twenty-front/public/index.html`
   ```html
   <title>Controlit Factory CRM</title>
   <meta name="description" content="Customer Relationship Management for Controlit Factory">
   ```

3. **Server Metadata:** `packages/twenty-server/package.json`
   ```json
   {
     "name": "@controlit/crm-server",
     "version": "1.0.0"
   }
   ```

#### 1.4 GitHub/Git References

**Files to Update:**

1. `packages/twenty-ui/src/navigation/link/constants/GithubLink.ts`
2. `packages/twenty-emails/src/components/Footer.tsx`
3. `packages/twenty-docker/twenty/Dockerfile` (line 72 - image label)
4. All workflow files in `.github/workflows/`

**Search and Replace:**
```bash
# Find all GitHub references
grep -r "twentyhq/twenty" . --exclude-dir=node_modules

# Replace with new repository
# twentyhq/twenty → akruminsh/controlit-crm
```

#### 1.5 Kubernetes Namespace

**Files:** `packages/twenty-docker/k8s/manifests/*.yaml`

**Changes:**
```yaml
# All K8s files
metadata:
  namespace: controlitfactory  # Changed from twentycrm
  name: controlit-crm-server   # Changed from twentycrm-server
  labels:
    app: controlit-crm          # Changed from twentycrm
```

### Priority 2: UI/UX Customization

#### 2.1 Company Logo & Favicon

**Files to Update:**

1. **Favicon:** `packages/twenty-front/public/favicon.ico`
2. **Logo:** `packages/twenty-front/public/logo192.png`, `logo512.png`
3. **Default Workspace Logo:** Update URL in database seed or config

**Action Items:**
- [ ] Design Controlit Factory logo
- [ ] Create favicon (16x16, 32x32, 192x192, 512x512)
- [ ] Replace all logo files
- [ ] Update default workspace logo URL

#### 2.2 Color Scheme & Theme

**File:** `packages/twenty-ui/src/theme/constants/Colors.ts`

**Customize:**
```typescript
// Update primary brand colors
export const THEME_COLORS = {
  primary: '#YOUR_PRIMARY_COLOR',
  secondary: '#YOUR_SECONDARY_COLOR',
  // ... other colors
};
```

**Alternative:** Use Emotion.js theme provider to inject custom theme

#### 2.3 Login Page Customization

**File:** `packages/twenty-front/src/pages/auth/SignIn.tsx`

**Changes:**
- Add Controlit Factory logo
- Update welcome text
- Customize login button styles
- Add company footer

### Priority 3: Functional Customization

#### 3.1 Default Workspace Configuration

**Customize:**
- Default workspace name: "Controlit Factory"
- Default objects (Companies, Contacts, etc.)
- Default fields and layouts
- User roles and permissions

**Implementation:**
- Update database seeds: `packages/twenty-server/src/database/typeorm/core/seeds/`
- Modify metadata sync: `packages/twenty-server/src/engine/workspace-manager/`

#### 3.2 Email Templates

**Files:** `packages/twenty-emails/src/emails/*.tsx`

**Customize Templates:**
- Welcome email
- Password reset
- Workspace invitation
- Notification emails

**Branding:**
- Add Controlit Factory header
- Update footer with company info
- Add social media links

#### 3.3 Feature Flags

**Disable Unused Features:**

```bash
# .env configuration
IS_BILLING_ENABLED=false              # No Stripe billing
IS_MULTIWORKSPACE_ENABLED=false       # Single workspace mode
ANALYTICS_ENABLED=false                # Disable ClickHouse analytics
TELEMETRY_ENABLED=false                # Disable telemetry to Twenty
CHROME_EXTENSION_ID=<custom-id>       # If building custom extension
```

#### 3.4 User Onboarding

**Customize:**
- First-time user experience
- Tutorial content
- Help documentation links
- Support contact information

**Files:**
- `packages/twenty-front/src/modules/onboarding/`
- Update in-app help URLs

### Priority 4: Security & Compliance

#### 4.1 Authentication Configuration

**File:** `.env` (production)

```bash
# Password authentication (enabled)
AUTH_PASSWORD_ENABLED=true

# OAuth providers (optional)
AUTH_GOOGLE_ENABLED=true
AUTH_GOOGLE_CLIENT_ID=<your-client-id>
AUTH_GOOGLE_CLIENT_SECRET=<your-client-secret>
AUTH_GOOGLE_CALLBACK_URL=https://crm.controlitfactory.eu/auth/google/redirect

# Disable Microsoft if not needed
AUTH_MICROSOFT_ENABLED=false
```

#### 4.2 Email Verification

```bash
IS_EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_EXPIRES_IN=24h
```

#### 4.3 Security Headers & CORS

**File:** `packages/twenty-server/src/main.ts`

**Ensure:**
- CORS restricted to `crm.controlitfactory.eu`
- Helmet.js security headers enabled
- Rate limiting configured

#### 4.4 Data Privacy

**Updates:**
- Privacy policy link
- Terms of service
- GDPR compliance settings
- Data retention policies

---

## Step-by-Step Deployment Guide

### Phase 1: Pre-Deployment Setup (Days 1-3)

#### Step 1.1: Provision Hostinger VPS

1. **Order VPS:**
   - Log in to Hostinger panel
   - Select **KVM 4** (4 vCPU, 16GB RAM, 200GB NVMe)
   - Choose OS: **Ubuntu 24.04 LTS** (recommended) or **Ubuntu 22.04 LTS**
   - Select datacenter location (Europe for best performance)

2. **Initial Server Access:**
   ```bash
   ssh root@<vps-ip-address>
   ```

3. **Initial System Setup:**
   ```bash
   # Update system
   apt update && apt upgrade -y

   # Set timezone
   timedatectl set-timezone Europe/Your_Timezone

   # Set hostname
   hostnamectl set-hostname controlit-crm

   # Create non-root user
   adduser controlit
   usermod -aG sudo controlit

   # Configure SSH key authentication
   mkdir -p /home/controlit/.ssh
   cp ~/.ssh/authorized_keys /home/controlit/.ssh/
   chown -R controlit:controlit /home/controlit/.ssh
   chmod 700 /home/controlit/.ssh
   chmod 600 /home/controlit/.ssh/authorized_keys
   ```

4. **Secure SSH:**
   ```bash
   # Edit SSH config
   nano /etc/ssh/sshd_config

   # Set:
   # PermitRootLogin no
   # PasswordAuthentication no
   # PubkeyAuthentication yes

   # Restart SSH
   systemctl restart sshd
   ```

5. **Configure Firewall:**
   ```bash
   ufw default deny incoming
   ufw default allow outgoing
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable
   ```

#### Step 1.2: Install Required Software

```bash
# Switch to controlit user
su - controlit

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker controlit
# Log out and log back in for group changes

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt install -y nginx

# Install Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Install Node.js 24 (for local builds if needed)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Install build essentials
sudo apt install -y build-essential git curl wget
```

#### Step 1.3: Configure Domain DNS

**In Hostinger DNS Panel (or your DNS provider):**

1. Log in to Hostinger control panel
2. Navigate to: Domains → Manage → DNS Records
3. Add DNS records:

```
Type    Name    Content             TTL
A       crm     <your-vps-ip>       3600
AAAA    crm     <your-vps-ipv6>     3600  (if available)
```

4. Wait for DNS propagation (5-60 minutes)
5. Verify: `dig crm.controlitfactory.eu`

### Phase 2: Repository Customization (Days 4-7)

#### Step 2.1: Clone and Customize Repository

**On Local Development Machine:**

```bash
# Clone repository
git clone http://local_proxy@127.0.0.1:24696/git/akruminsh/controlit-crm
cd controlit-crm

# Create customization branch
git checkout -b feature/controlit-customization

# Install dependencies
yarn install
```

#### Step 2.2: Apply Critical Branding Changes

**Automated Search & Replace Script:**

```bash
#!/bin/bash
# customize-branding.sh

# Replace docker image references
find packages/twenty-docker -type f -name "*.yml" -o -name "*.yaml" | \
  xargs sed -i 's/twentycrm\/twenty/controlitfactory\/crm/g'

# Replace email defaults
sed -i "s/Felix from Twenty/Controlit Factory CRM/g" \
  packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts

sed -i "s/noreply@yourdomain.com/noreply@controlitfactory.eu/g" \
  packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts

# Update package name
sed -i 's/"name": "twenty"/"name": "controlit-crm"/g' package.json

# Update Kubernetes namespace
find packages/twenty-docker/k8s -type f -name "*.yaml" | \
  xargs sed -i 's/namespace: twentycrm/namespace: controlitfactory/g'

echo "Branding customization complete!"
```

**Run Customization:**
```bash
chmod +x customize-branding.sh
./customize-branding.sh
```

#### Step 2.3: Update Environment Configuration

**Create production .env file:**

```bash
# packages/twenty-docker/.env.production

# Node environment
NODE_ENV=production

# Database
PG_DATABASE_URL=postgres://controlit:SECURE_PASSWORD@db:5432/controlit_crm
PG_DATABASE_USER=controlit
PG_DATABASE_PASSWORD=SECURE_PASSWORD  # Generate: openssl rand -hex 32
PG_DATABASE_NAME=controlit_crm

# Redis
REDIS_URL=redis://redis:6379

# Application Secret (CRITICAL - Generate unique!)
APP_SECRET=GENERATE_THIS_WITH_OPENSSL  # openssl rand -base64 32

# URLs
SERVER_URL=https://crm.controlitfactory.eu
FRONTEND_URL=https://crm.controlitfactory.eu

# Email Configuration
EMAIL_FROM_NAME=Controlit Factory CRM
EMAIL_FROM_ADDRESS=noreply@controlitfactory.eu
EMAIL_SYSTEM_ADDRESS=system@controlitfactory.eu
EMAIL_DRIVER=smtp
EMAIL_SMTP_HOST=smtp.hostinger.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=noreply@controlitfactory.eu
EMAIL_SMTP_PASSWORD=YOUR_EMAIL_PASSWORD

# Authentication
AUTH_PASSWORD_ENABLED=true
SIGN_IN_PREFILLED=false  # Disable for production

# Optional: Google OAuth
# AUTH_GOOGLE_ENABLED=true
# AUTH_GOOGLE_CLIENT_ID=...
# AUTH_GOOGLE_CLIENT_SECRET=...
# AUTH_GOOGLE_CALLBACK_URL=https://crm.controlitfactory.eu/auth/google/redirect

# Features
IS_BILLING_ENABLED=false
IS_MULTIWORKSPACE_ENABLED=false
ANALYTICS_ENABLED=false
TELEMETRY_ENABLED=false

# Storage
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=.local-storage

# Security
IS_EMAIL_VERIFICATION_REQUIRED=true
CAPTCHA_DRIVER=none

# Logging
LOGGER_DRIVER=console
LOG_LEVELS=error,warn,log
```

**Generate Secrets:**
```bash
# Generate APP_SECRET
openssl rand -base64 32

# Generate PG_DATABASE_PASSWORD
openssl rand -hex 32
```

#### Step 2.4: Build Docker Images

**Option A: Build Locally and Push to Docker Hub**

```bash
# Login to Docker Hub
docker login

# Build image
cd packages/twenty-docker
docker build -t controlitfactory/crm:v1.0.0 -f twenty/Dockerfile ../..

# Tag as latest
docker tag controlitfactory/crm:v1.0.0 controlitfactory/crm:latest

# Push to registry
docker push controlitfactory/crm:v1.0.0
docker push controlitfactory/crm:latest
```

**Option B: Use GitHub Actions (Recommended)**

Create `.github/workflows/build-and-push.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main, production]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: controlitfactory/crm
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: packages/twenty-docker/twenty/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

#### Step 2.5: Commit and Push Changes

```bash
# Review changes
git status
git diff

# Commit customizations
git add .
git commit -m "feat: Customize Twenty CRM for Controlit Factory

- Updated branding and email configurations
- Changed Docker image references
- Configured for crm.controlitfactory.eu deployment
- Added production environment configuration
- Updated Kubernetes namespace to controlitfactory"

# Push to repository
git push origin feature/controlit-customization

# Create PR and merge to main
```

### Phase 3: Server Deployment (Days 8-10)

#### Step 3.1: Prepare Server Directories

**On VPS (as controlit user):**

```bash
# Create application directory
sudo mkdir -p /opt/controlit-crm
sudo chown controlit:controlit /opt/controlit-crm
cd /opt/controlit-crm

# Create directory structure
mkdir -p {config,data,logs,backups}
```

#### Step 3.2: Deploy Docker Compose Stack

```bash
# Clone customized repository
git clone <your-repository-url> /opt/controlit-crm/app
cd /opt/controlit-crm/app/packages/twenty-docker

# Copy production environment file
cp .env.production .env

# Edit .env with actual secrets
nano .env
# Update:
# - APP_SECRET
# - PG_DATABASE_PASSWORD
# - EMAIL_SMTP_PASSWORD

# Pull Docker images
docker-compose pull

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

**Expected Output:**
```
NAME                STATUS              PORTS
twenty-server-1     Up 2 minutes        0.0.0.0:3000->3000/tcp
twenty-worker-1     Up 2 minutes
twenty-db-1         Up 2 minutes        5432/tcp
twenty-redis-1      Up 2 minutes        6379/tcp
```

#### Step 3.3: Initialize Database

```bash
# Wait for server to be healthy (check logs)
docker-compose logs -f server

# Database migrations run automatically on first start
# Look for log message: "Database migrations completed successfully"

# Verify database connection
docker-compose exec db psql -U controlit -d controlit_crm -c "\dt"
```

#### Step 3.4: Configure Nginx Reverse Proxy

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/controlit-crm

# Paste configuration:
```

```nginx
server {
    listen 80;
    server_name crm.controlitfactory.eu;

    # Temporary: allow Certbot to validate domain
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS (will be enabled after SSL)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/controlit-crm /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Step 3.5: Obtain SSL Certificate

```bash
# Request certificate from Let's Encrypt
sudo certbot --nginx -d crm.controlitfactory.eu

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Select: Redirect HTTP to HTTPS (option 2)

# Verify certificate
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run
```

**Certbot will automatically:**
- Obtain SSL certificate
- Update Nginx configuration
- Set up auto-renewal cron job

#### Step 3.6: Update Nginx for HTTPS (if not done by Certbot)

```bash
sudo nano /etc/nginx/sites-available/controlit-crm
```

```nginx
server {
    listen 80;
    server_name crm.controlitfactory.eu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.controlitfactory.eu;

    ssl_certificate /etc/letsencrypt/live/crm.controlitfactory.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.controlitfactory.eu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # File upload limit
    client_max_body_size 100M;

    # Logging
    access_log /var/log/nginx/controlit-crm-access.log;
    error_log /var/log/nginx/controlit-crm-error.log;
}
```

```bash
# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Phase 4: Testing & Verification (Days 11-12)

#### Step 4.1: Health Check

```bash
# Check all services running
docker-compose ps

# Check server health endpoint
curl -k https://crm.controlitfactory.eu/healthz

# Expected: {"status": "ok"}

# Check logs for errors
docker-compose logs server | grep -i error
docker-compose logs worker | grep -i error
```

#### Step 4.2: Initial Application Setup

1. **Open Browser:** `https://crm.controlitfactory.eu`

2. **Create First User:**
   - Email: your-email@controlitfactory.eu
   - Password: Strong password
   - Workspace: "Controlit Factory"

3. **Verify Email:** Check inbox for verification email

4. **Complete Onboarding:** Follow setup wizard

#### Step 4.3: Functional Testing

**Test Checklist:**
- [ ] User registration works
- [ ] Email verification works
- [ ] Login/logout works
- [ ] Create company record
- [ ] Create contact record
- [ ] Create opportunity
- [ ] Upload file attachment
- [ ] GraphQL API responds
- [ ] WebSocket subscriptions work
- [ ] Background jobs process (check worker logs)
- [ ] Email sending works (test password reset)

#### Step 4.4: Performance Testing

```bash
# Install Apache Bench (if not installed)
sudo apt install apache2-utils

# Test homepage
ab -n 100 -c 10 https://crm.controlitfactory.eu/

# Test GraphQL endpoint (create test query)
ab -n 50 -c 5 -p graphql-query.json -T application/json https://crm.controlitfactory.eu/graphql
```

**Monitor Resource Usage:**
```bash
# Check Docker stats
docker stats

# Check system resources
htop  # or top

# Check disk usage
df -h
docker system df
```

### Phase 5: Production Hardening (Days 13-14)

#### Step 5.1: Set Up Automated Backups

**Database Backup Script:**

```bash
sudo nano /opt/controlit-crm/backup-database.sh
```

```bash
#!/bin/bash
# backup-database.sh

BACKUP_DIR="/opt/controlit-crm/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/controlit_crm_$TIMESTAMP.sql.gz"

# Create backup
docker-compose -f /opt/controlit-crm/app/packages/twenty-docker/docker-compose.yml \
  exec -T db pg_dump -U controlit controlit_crm | gzip > "$BACKUP_FILE"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "controlit_crm_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

```bash
# Make executable
chmod +x /opt/controlit-crm/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add:
0 2 * * * /opt/controlit-crm/backup-database.sh >> /opt/controlit-crm/logs/backup.log 2>&1
```

**File Storage Backup:**

```bash
# Backup uploaded files
sudo nano /opt/controlit-crm/backup-files.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/controlit-crm/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VOLUME_NAME=$(docker volume ls -q | grep server-local-data)

# Backup volume
docker run --rm -v $VOLUME_NAME:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/files_$TIMESTAMP.tar.gz -C /data .

# Keep only last 30 days
find "$BACKUP_DIR" -name "files_*.tar.gz" -mtime +30 -delete

echo "File backup completed: files_$TIMESTAMP.tar.gz"
```

```bash
chmod +x /opt/controlit-crm/backup-files.sh

# Add to crontab (daily at 3 AM)
0 3 * * * /opt/controlit-crm/backup-files.sh >> /opt/controlit-crm/logs/backup.log 2>&1
```

#### Step 5.2: Set Up Monitoring

**Install Monitoring Tools:**

```bash
# Install Netdata (lightweight monitoring)
bash <(curl -Ss https://get.netdata.cloud/kickstart.sh) --dont-wait

# Access: http://<vps-ip>:19999
# Configure Nginx reverse proxy if needed
```

**Docker Container Monitoring:**

```bash
# Install ctop (container top)
sudo wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
sudo chmod +x /usr/local/bin/ctop

# Run: ctop
```

**Application Health Monitoring:**

```bash
# Create healthcheck script
sudo nano /opt/controlit-crm/healthcheck.sh
```

```bash
#!/bin/bash
HEALTH_URL="https://crm.controlitfactory.eu/healthz"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$RESPONSE" != "200" ]; then
    echo "ALERT: Application health check failed! HTTP $RESPONSE"
    # Send notification (email, Slack, etc.)
    # Optionally restart services:
    # cd /opt/controlit-crm/app/packages/twenty-docker
    # docker-compose restart server
fi
```

```bash
chmod +x /opt/controlit-crm/healthcheck.sh

# Add to crontab (every 5 minutes)
*/5 * * * * /opt/controlit-crm/healthcheck.sh >> /opt/controlit-crm/logs/healthcheck.log 2>&1
```

#### Step 5.3: Configure Log Rotation

```bash
sudo nano /etc/logrotate.d/controlit-crm
```

```
/opt/controlit-crm/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 controlit controlit
    sharedscripts
}

/var/log/nginx/controlit-crm-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

#### Step 5.4: Security Hardening

**Install Fail2Ban:**

```bash
# Install
sudo apt install fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/controlit-crm-error.log
```

```bash
# Start Fail2Ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Enable Automatic Security Updates:**

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Docker Security:**

```bash
# Enable Docker content trust
echo 'export DOCKER_CONTENT_TRUST=1' >> ~/.bashrc

# Scan images for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image controlitfactory/crm:latest
```

### Phase 6: Documentation & Handoff (Days 15-17)

#### Step 6.1: Create Operations Manual

**Document:**
1. Server access credentials
2. Docker commands cheat sheet
3. Backup restore procedures
4. Troubleshooting guide
5. Update/upgrade procedures

#### Step 6.2: User Training

**Create Training Materials:**
1. User guide for CRM features
2. Admin guide for user management
3. Video tutorials (optional)

#### Step 6.3: Handoff Checklist

- [ ] VPS access credentials provided
- [ ] Docker Hub access provided
- [ ] Git repository access confirmed
- [ ] Admin user credentials provided
- [ ] Backup procedures documented
- [ ] Monitoring dashboard access provided
- [ ] Support contact established
- [ ] SSL certificate renewal verified (auto-renews)

---

## Cost Analysis

### One-Time Costs

| Item | Cost | Notes |
|------|------|-------|
| **Domain Registration** | €10-20/year | Already owned: controlitfactory.eu |
| **Development Time** | Internal | ~80-120 hours |
| **SSL Certificate** | €0 | Let's Encrypt (free) |
| **Initial Setup** | Internal | ~16-24 hours |

### Recurring Monthly Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Hostinger VPS KVM 4** | $12/month | 4 vCPU, 16GB RAM, 200GB NVMe |
| **Docker Hub** | €0 | Free tier (public images) |
| **External Backups** | €5-10/month | Optional: AWS S3 / Backblaze B2 |
| **Email Service** | €0-5/month | Hostinger includes email |
| **Monitoring** | €0 | Netdata free (self-hosted) |
| **Total** | **~$12-17/month** | |

### Cost Comparison

| Option | Monthly Cost | Pros | Cons |
|--------|--------------|------|------|
| **Self-Hosted (Hostinger)** | $12-17 | Full control, data sovereignty | Requires DevOps skills |
| **Twenty Cloud** | $99-299 | Managed, updates | Expensive, vendor lock-in |
| **Salesforce** | $25-300/user | Enterprise features | Very expensive, complex |
| **HubSpot CRM** | €0-1,600 | Free tier available | Limited features on free plan |

**Verdict:** Self-hosting on Hostinger is **10-20x cheaper** than SaaS alternatives for small teams.

### 3-Year TCO (Total Cost of Ownership)

**Self-Hosted Option:**
- VPS: $12/mo × 36 = $432
- Backups: $10/mo × 36 = $360
- Maintenance (10 hrs/mo @ $50/hr): $18,000
- **Total: ~$18,792 (€17,500)**

**SaaS Option (Twenty Cloud @ $99/mo for 5 users):**
- Subscription: $99/mo × 36 = $3,564
- Additional users (scale): +$2,000
- **Total: ~$5,564 (€5,200)**

**Note:** SaaS becomes more cost-effective if maintenance burden is high. However, self-hosting provides:
- Full data control
- Unlimited customization
- No per-user costs
- No vendor lock-in

---

## Maintenance & Operations

### Daily Operations

**Morning Checklist:**
- [ ] Check application is accessible: `https://crm.controlitfactory.eu`
- [ ] Review overnight logs: `docker-compose logs --since 24h`
- [ ] Check disk space: `df -h`

**Weekly Tasks:**
- [ ] Review monitoring dashboard (Netdata)
- [ ] Check backup logs: `cat /opt/controlit-crm/logs/backup.log`
- [ ] Review application logs for errors
- [ ] Check for security updates: `sudo apt update && sudo apt list --upgradable`

**Monthly Tasks:**
- [ ] Apply security updates: `sudo apt upgrade -y`
- [ ] Review resource usage trends
- [ ] Test backup restore procedure
- [ ] Rotate logs: `sudo logrotate -f /etc/logrotate.conf`
- [ ] Review user accounts and permissions

### Update Procedures

#### Application Updates (New Version)

```bash
# 1. Pull latest code
cd /opt/controlit-crm/app
git pull origin main

# 2. Backup database FIRST
/opt/controlit-crm/backup-database.sh

# 3. Build new image
cd packages/twenty-docker
docker-compose build

# 4. Stop services
docker-compose down

# 5. Start with new image
docker-compose up -d

# 6. Verify
docker-compose logs -f
curl https://crm.controlitfactory.eu/healthz
```

#### Database Migrations

```bash
# Migrations run automatically on server start
# Check logs:
docker-compose logs server | grep migration

# Manual migration (if needed):
docker-compose exec server npx typeorm migration:run -d dist/src/database/typeorm/core/core.datasource
```

#### Rollback Procedure

```bash
# 1. Stop services
cd /opt/controlit-crm/app/packages/twenty-docker
docker-compose down

# 2. Restore database from backup
BACKUP_FILE=$(ls -t /opt/controlit-crm/backups/*.sql.gz | head -1)
gunzip -c $BACKUP_FILE | docker-compose exec -T db psql -U controlit -d controlit_crm

# 3. Revert code
git revert HEAD  # or git reset --hard <previous-commit>

# 4. Rebuild and start
docker-compose build
docker-compose up -d

# 5. Verify
curl https://crm.controlitfactory.eu/healthz
```

### Common Issues & Solutions

#### Issue: Application Not Responding

**Symptoms:** 502 Bad Gateway, timeout errors

**Diagnosis:**
```bash
# Check if containers are running
docker-compose ps

# Check logs
docker-compose logs server --tail 100

# Check resources
docker stats
```

**Solutions:**
1. **Container crashed:** `docker-compose restart server`
2. **Out of memory:** Increase VPS RAM or optimize config
3. **Database connection:** Check PostgreSQL logs: `docker-compose logs db`

#### Issue: High Memory Usage

**Diagnosis:**
```bash
docker stats --no-stream
htop
```

**Solutions:**
1. **Restart worker:** `docker-compose restart worker`
2. **Clear Redis cache:** `docker-compose exec redis redis-cli FLUSHALL`
3. **Optimize PostgreSQL:** Adjust `shared_buffers`, `work_mem` in `postgresql.conf`

#### Issue: Slow Performance

**Diagnosis:**
```bash
# Check database query performance
docker-compose exec db psql -U controlit -d controlit_crm
# Run: SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# Check Redis memory
docker-compose exec redis redis-cli INFO memory
```

**Solutions:**
1. Add database indexes
2. Increase Redis memory limit
3. Enable query caching
4. Upgrade VPS plan

#### Issue: SSL Certificate Expiry

**Diagnosis:**
```bash
sudo certbot certificates
# Check expiry date
```

**Solutions:**
```bash
# Manual renewal (auto-renewal should work)
sudo certbot renew

# Reload Nginx
sudo systemctl reload nginx

# Check auto-renewal timer
sudo systemctl status certbot.timer
```

---

## Risk Assessment & Mitigation

### Technical Risks

#### Risk 1: Data Loss

**Probability:** Low
**Impact:** Critical
**Mitigation:**
- ✅ Daily automated backups
- ✅ Backup retention (30 days)
- ✅ Offsite backup storage (recommended: AWS S3)
- ✅ Regular restore testing
- ✅ Database replication (future enhancement)

#### Risk 2: Server Downtime

**Probability:** Low-Medium
**Impact:** High
**Mitigation:**
- ✅ Health monitoring with alerts
- ✅ Docker automatic restart policies
- ✅ Hostinger 99.9% uptime SLA
- ⚠️ Consider load balancer for HA (future)
- ⚠️ Set up standby server for failover (future)

#### Risk 3: Security Breach

**Probability:** Low
**Impact:** Critical
**Mitigation:**
- ✅ Firewall (UFW) configured
- ✅ SSH key-only authentication
- ✅ Fail2Ban intrusion prevention
- ✅ SSL/TLS encryption
- ✅ Regular security updates
- ✅ Docker security scanning
- ✅ Limited SSH access (controlit user only)
- ✅ AGPL-3.0 license compliance

#### Risk 4: Performance Degradation

**Probability:** Medium
**Impact:** Medium
**Mitigation:**
- ✅ Monitoring (Netdata, Docker stats)
- ✅ Resource alerts
- ✅ Performance testing
- ⚠️ CDN for static assets (future)
- ⚠️ Database query optimization (ongoing)

#### Risk 5: Dependency Vulnerabilities

**Probability:** Medium
**Impact:** Medium-High
**Mitigation:**
- ✅ Regular dependency updates
- ✅ Security scanning (Trivy)
- ✅ Node.js LTS version (24.x)
- ✅ Automated security updates (unattended-upgrades)
- ⚠️ Subscribe to security advisories

### Operational Risks

#### Risk 6: Knowledge Loss (Single Point of Failure)

**Probability:** Medium
**Impact:** High
**Mitigation:**
- ✅ Comprehensive documentation (this document)
- ✅ Operations manual
- ✅ Runbook for common issues
- ⚠️ Train backup administrator
- ⚠️ Document all passwords in secure vault (1Password, Bitwarden)

#### Risk 7: Scalability Limitations

**Probability:** Medium (as company grows)
**Impact:** Medium
**Mitigation:**
- ✅ VPS can be upgraded vertically (up to 32GB RAM)
- ⚠️ Plan migration to multi-server architecture
- ⚠️ Consider managed PostgreSQL (future)
- ⚠️ Implement caching strategies
- ⚠️ Database sharding (if needed)

### Business Risks

#### Risk 8: Vendor Lock-in (Hostinger)

**Probability:** Low
**Impact:** Medium
**Mitigation:**
- ✅ Docker-based deployment (portable)
- ✅ Standard technologies (PostgreSQL, Redis, Node.js)
- ✅ Can migrate to any VPS provider
- ✅ Can migrate to AWS/Azure/GCP
- ✅ Documented infrastructure as code

#### Risk 9: Compliance & Legal

**Probability:** Low
**Impact:** High
**Mitigation:**
- ✅ AGPL-3.0 compliance (source code availability)
- ✅ GDPR compliance features (data export, deletion)
- ⚠️ Privacy policy required
- ⚠️ Terms of service required
- ⚠️ Data processing agreement (if handling EU citizens)

---

## Next Steps & Recommendations

### Immediate Actions (Week 1)

1. **Approve Plan:** Review and approve this deployment plan
2. **Provision VPS:** Order Hostinger KVM 4 VPS
3. **Set Up DNS:** Configure `crm.controlitfactory.eu` DNS record
4. **Customize Codebase:** Apply branding changes
5. **Build Docker Images:** Create and push custom images

### Short-Term (Weeks 2-4)

1. **Deploy to Production:** Follow deployment guide
2. **User Acceptance Testing:** Test all features
3. **Create User Accounts:** Add initial employees
4. **Import Data:** Migrate from existing CRM (if any)
5. **Train Users:** Conduct training sessions

### Medium-Term (Months 2-3)

1. **Monitor Usage:** Track performance and resource usage
2. **Gather Feedback:** Collect user feedback for improvements
3. **Optimize:** Fine-tune performance based on real usage
4. **Backup Testing:** Verify backup/restore procedures
5. **Documentation:** Update based on lessons learned

### Long-Term (Months 4-12)

1. **Custom Features:** Develop Controlit-specific features
2. **Integrations:** Add integrations with other systems
3. **Mobile Access:** Optimize for mobile devices
4. **Advanced Analytics:** Implement custom reports
5. **Scale Infrastructure:** Upgrade VPS or migrate to HA setup if needed

### Future Enhancements

**Priority 1:**
- [ ] External backup storage (AWS S3 / Backblaze B2)
- [ ] Email notifications for system alerts
- [ ] Uptime monitoring (UptimeRobot, Pingdom)
- [ ] Custom domain email integration

**Priority 2:**
- [ ] High availability setup (2+ servers)
- [ ] Database read replicas
- [ ] CDN for static assets (Cloudflare)
- [ ] Advanced monitoring (Prometheus + Grafana)

**Priority 3:**
- [ ] Custom branding (logo, colors, themes)
- [ ] Company-specific workflows
- [ ] Integration with Controlit Factory systems
- [ ] Mobile application (React Native / PWA)

---

## Conclusion

This comprehensive plan provides a roadmap for deploying the Controlit Factory CRM on Hostinger VPS infrastructure. The deployment is **technically feasible**, **cost-effective**, and **scalable** for a small to medium-sized team.

### Success Factors

✅ **Technical Feasibility:** All required technologies supported on Hostinger VPS
✅ **Cost Efficiency:** ~$12-17/month vs $99-299/month for SaaS
✅ **Scalability:** Can grow from 5 to 50+ users
✅ **Independence:** Full control over data and customization
✅ **Security:** Enterprise-grade security with proper configuration

### Key Decisions Required

1. **VPS Plan:** Recommend KVM 4 (16GB RAM) for production
2. **Build Strategy:** GitHub Actions vs local build
3. **Backup Storage:** Local only vs external (S3/Backblaze)
4. **Customization Scope:** Basic branding vs full rebranding
5. **Support Plan:** Internal management vs external DevOps support

### Estimated Timeline

- **Minimal Deployment:** 1-2 weeks (basic setup)
- **Production-Ready:** 2-3 weeks (with testing and hardening)
- **Full Customization:** 4-6 weeks (including branding and training)

---

## Appendix

### A. Useful Commands

```bash
# Docker Compose
docker-compose up -d                 # Start services
docker-compose down                  # Stop services
docker-compose restart server        # Restart server
docker-compose logs -f server        # Follow server logs
docker-compose exec server bash      # Enter server container
docker-compose ps                    # List containers
docker system prune -a               # Clean up Docker

# Database
docker-compose exec db psql -U controlit -d controlit_crm
docker-compose exec db pg_dump -U controlit controlit_crm > backup.sql
docker-compose exec -T db psql -U controlit -d controlit_crm < backup.sql

# Monitoring
docker stats                         # Container resource usage
htop                                 # System resource usage
du -sh /var/lib/docker/              # Docker disk usage
df -h                                # Disk usage

# Nginx
sudo nginx -t                        # Test configuration
sudo systemctl reload nginx          # Reload configuration
sudo systemctl status nginx          # Check status
tail -f /var/log/nginx/controlit-crm-access.log  # Watch access log

# SSL
sudo certbot certificates            # List certificates
sudo certbot renew                   # Renew certificates
sudo certbot delete --cert-name crm.controlitfactory.eu  # Delete cert
```

### B. Environment Variables Reference

See `packages/twenty-server/.env.example` for full list (84 variables).

**Critical Variables:**
- `NODE_ENV` - production
- `APP_SECRET` - Random 32-byte string
- `PG_DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `SERVER_URL` - https://crm.controlitfactory.eu
- `FRONTEND_URL` - https://crm.controlitfactory.eu
- `EMAIL_FROM_NAME` - Controlit Factory CRM
- `EMAIL_SMTP_*` - SMTP configuration

### C. Contact Information

**For Technical Support:**
- Repository: <your-repository-url>
- Documentation: This file
- Issue Tracker: <repository>/issues

**For Hostinger Support:**
- Panel: https://hpanel.hostinger.com
- Support: Live chat / ticket system
- Documentation: https://support.hostinger.com

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Author:** Claude Code
**Status:** ✅ Ready for Implementation
