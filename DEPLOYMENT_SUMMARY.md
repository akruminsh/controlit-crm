# Controlit Factory CRM - Deployment Summary

**Quick Reference Guide for crm.controlitfactory.eu Deployment**

---

## Repository Audit Summary

### Current Status
- **Repository:** Twenty CRM-based monorepo (14 packages)
- **Tech Stack:** NestJS + React 18 + PostgreSQL 16 + Redis
- **License:** AGPL-3.0
- **Version:** 0.2.1 (Based on Twenty CRM)
- **Node.js:** 24.5.0+

### Key Infrastructure Requirements
- PostgreSQL 16 with extensions (uuid-ossp, unaccent)
- Redis 6+ for caching and job queues
- Node.js 24+ runtime
- 16GB RAM minimum (for builds)
- Docker & Docker Compose
- SSL certificate
- SMTP server for emails

---

## Repository Separation Plan

### Why Separate?
1. Remove dependency on Twenty CRM upstream
2. Full customization freedom
3. Remove "Twenty" branding
4. Establish Controlit Factory ownership

### How to Separate

**Option 1: Detach Fork (Recommended)**
```bash
git clone <current-repo> controlit-crm-new
cd controlit-crm-new
git remote remove origin
git remote add origin <new-repo-url>
git checkout -b main
git push -u origin main
```

**Option 2: Fresh Start**
```bash
git checkout --orphan new-main
git add .
git commit -m "Initial commit: Controlit Factory CRM v1.0.0"
git push -u origin new-main
```

---

## Hostinger Deployment Plan

### Recommended VPS Plan

**Hostinger KVM 4** (Recommended)
- **vCPU:** 4 cores
- **RAM:** 16GB
- **Storage:** 200GB NVMe SSD
- **Bandwidth:** Unlimited
- **Cost:** ~$12/month
- **Why:** Sufficient for builds + production runtime with headroom

**Alternative:** KVM 2 (8GB RAM, ~$7/mo) if building elsewhere

### Architecture

```
Internet
  ↓
crm.controlitfactory.eu (DNS)
  ↓
Hostinger VPS
  ↓
Nginx (SSL + Reverse Proxy)
  ↓
Docker Compose:
  - CRM Server (Node.js)
  - CRM Worker (Background Jobs)
  - PostgreSQL 16
  - Redis
```

### Key Services
- **Nginx:** Port 80/443, SSL termination, reverse proxy
- **Server Container:** Port 3000, GraphQL API + React frontend
- **Worker Container:** Background job processing (BullMQ)
- **PostgreSQL:** Database storage
- **Redis:** Cache + job queue

---

## Critical Customizations Required

### Priority 1: Branding Changes

#### Docker Images
Change all references from `twentycrm/twenty` to `controlitfactory/crm`:
- `packages/twenty-docker/docker-compose.yml`
- `render.yaml`
- Kubernetes manifests in `packages/twenty-docker/k8s/`

#### Email Configuration
Update in `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`:
- `EMAIL_FROM_NAME`: "Controlit Factory CRM"
- `EMAIL_FROM_ADDRESS`: "noreply@controlitfactory.eu"
- `EMAIL_SYSTEM_ADDRESS`: "system@controlitfactory.eu"

#### Package Names
- Root `package.json`: Change `"name": "twenty"` to `"name": "controlit-crm"`
- Server `package.json`: Change to `"@controlit/crm-server"`
- Frontend metadata: Update titles and descriptions

#### GitHub References
Replace all `twentyhq/twenty` references with `akruminsh/controlit-crm`
```bash
grep -r "twentyhq/twenty" . --exclude-dir=node_modules
# Then replace accordingly
```

### Priority 2: UI Customization
- Logo and favicon replacement
- Color scheme customization
- Login page branding
- Email template updates

### Priority 3: Feature Configuration
- Disable billing: `IS_BILLING_ENABLED=false`
- Single workspace mode: `IS_MULTIWORKSPACE_ENABLED=false`
- Disable analytics: `ANALYTICS_ENABLED=false`
- Disable telemetry: `TELEMETRY_ENABLED=false`

---

## Quick Deployment Steps

### 1. Provision Server (Day 1)
```bash
# Order Hostinger KVM 4 VPS with Ubuntu 24.04
# Configure DNS: A record crm → VPS IP
# SSH into server
ssh root@<vps-ip>
```

### 2. Server Setup (Day 1)
```bash
# Update system
apt update && apt upgrade -y

# Create user
adduser controlit
usermod -aG sudo controlit

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker controlit

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Configure firewall
ufw allow 22,80,443/tcp
ufw enable
```

### 3. Deploy Application (Day 2)
```bash
# Clone repo
mkdir -p /opt/controlit-crm
cd /opt/controlit-crm
git clone <repo-url> app
cd app/packages/twenty-docker

# Create .env file
cp .env.example .env
nano .env
# Set:
# - APP_SECRET (openssl rand -base64 32)
# - PG_DATABASE_PASSWORD (openssl rand -hex 32)
# - Email SMTP credentials
# - SERVER_URL=https://crm.controlitfactory.eu

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Configure Nginx (Day 2)
```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/controlit-crm

# Add proxy configuration (see full plan)
# Enable site
sudo ln -s /etc/nginx/sites-available/controlit-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d crm.controlitfactory.eu
```

### 5. Verify (Day 2)
```bash
# Check health
curl https://crm.controlitfactory.eu/healthz

# Open browser
# https://crm.controlitfactory.eu

# Create first user
# Test all features
```

### 6. Set Up Backups (Day 3)
```bash
# Create backup script
nano /opt/controlit-crm/backup-database.sh
# (See full plan for script)

# Add to crontab
crontab -e
# 0 2 * * * /opt/controlit-crm/backup-database.sh
```

---

## Production Environment Variables

```bash
# Core
NODE_ENV=production
APP_SECRET=<generate-with-openssl-rand-base64-32>

# Database
PG_DATABASE_URL=postgres://controlit:<password>@db:5432/controlit_crm
PG_DATABASE_PASSWORD=<generate-with-openssl-rand-hex-32>

# Redis
REDIS_URL=redis://redis:6379

# URLs
SERVER_URL=https://crm.controlitfactory.eu
FRONTEND_URL=https://crm.controlitfactory.eu

# Email
EMAIL_FROM_NAME=Controlit Factory CRM
EMAIL_FROM_ADDRESS=noreply@controlitfactory.eu
EMAIL_DRIVER=smtp
EMAIL_SMTP_HOST=smtp.hostinger.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=noreply@controlitfactory.eu
EMAIL_SMTP_PASSWORD=<your-email-password>

# Features
IS_BILLING_ENABLED=false
IS_MULTIWORKSPACE_ENABLED=false
ANALYTICS_ENABLED=false
TELEMETRY_ENABLED=false

# Security
IS_EMAIL_VERIFICATION_REQUIRED=true
AUTH_PASSWORD_ENABLED=true
SIGN_IN_PREFILLED=false
```

---

## Cost Breakdown

### Monthly Costs
- **VPS:** $12/month (Hostinger KVM 4)
- **External Backups:** $5-10/month (optional)
- **Total:** ~$12-17/month

### Comparison
- **Self-Hosted:** $12-17/month
- **Twenty Cloud:** $99-299/month
- **Salesforce:** $25-300/user/month
- **HubSpot:** $0-1,600/month

**Savings:** 80-95% vs SaaS alternatives

---

## Critical Files Reference

### Configuration Files
- `packages/twenty-docker/.env` - Production environment variables
- `packages/twenty-docker/docker-compose.yml` - Container orchestration
- `/etc/nginx/sites-available/controlit-crm` - Nginx configuration
- `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts` - App defaults

### Customization Files
- `package.json` - Root package name
- `packages/twenty-front/public/index.html` - Frontend metadata
- `packages/twenty-ui/src/theme/constants/Colors.ts` - Theme colors
- `packages/twenty-emails/src/emails/*.tsx` - Email templates

### Infrastructure Files
- `packages/twenty-docker/twenty/Dockerfile` - Container build
- `packages/twenty-docker/k8s/manifests/*.yaml` - Kubernetes (optional)
- `.github/workflows/*.yml` - CI/CD pipelines

---

## Essential Commands

### Docker Management
```bash
docker-compose up -d              # Start services
docker-compose down               # Stop services
docker-compose restart server     # Restart server
docker-compose logs -f server     # View logs
docker-compose ps                 # List containers
```

### Database Operations
```bash
# Backup
docker-compose exec db pg_dump -U controlit controlit_crm | gzip > backup.sql.gz

# Restore
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U controlit -d controlit_crm

# Access DB
docker-compose exec db psql -U controlit -d controlit_crm
```

### Monitoring
```bash
docker stats                      # Container resources
htop                             # System resources
df -h                            # Disk usage
curl https://crm.controlitfactory.eu/healthz  # Health check
```

### Nginx
```bash
sudo nginx -t                     # Test config
sudo systemctl reload nginx       # Reload
sudo systemctl status nginx       # Status
sudo certbot renew                # Renew SSL
```

---

## Security Checklist

- [ ] Firewall enabled (UFW): ports 22, 80, 443 only
- [ ] SSH key-only authentication (no passwords)
- [ ] Root login disabled
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Strong APP_SECRET generated
- [ ] Strong database password generated
- [ ] Fail2Ban installed and configured
- [ ] Automatic security updates enabled
- [ ] Regular backups configured
- [ ] Email verification enabled
- [ ] CORS restricted to domain
- [ ] Security headers configured in Nginx

---

## Maintenance Schedule

### Daily
- Check application is accessible
- Review error logs

### Weekly
- Review monitoring dashboard
- Check backup logs
- Apply security updates

### Monthly
- Test backup restore procedure
- Review resource usage trends
- Rotate logs
- Review user accounts

---

## Troubleshooting Quick Reference

### Application Not Responding
```bash
docker-compose ps                 # Check container status
docker-compose logs server        # Check server logs
docker-compose restart server     # Restart if needed
```

### High Memory Usage
```bash
docker stats                      # Check container memory
docker-compose restart worker     # Restart worker
docker-compose exec redis redis-cli FLUSHALL  # Clear cache
```

### Database Issues
```bash
docker-compose logs db            # Check DB logs
docker-compose exec db psql -U controlit -d controlit_crm  # Access DB
# Check connections: SELECT * FROM pg_stat_activity;
```

### SSL Certificate Issues
```bash
sudo certbot certificates         # Check expiry
sudo certbot renew                # Renew manually
sudo systemctl status certbot.timer  # Check auto-renewal
```

---

## Next Steps

1. **Review Full Plan:** Read `/DEPLOYMENT_PLAN.md` for comprehensive details
2. **Approve Budget:** VPS ~$12/mo + optional backups $5-10/mo
3. **Order VPS:** Hostinger KVM 4 (16GB RAM recommended)
4. **Configure DNS:** Add A record for crm.controlitfactory.eu
5. **Apply Customizations:** Update branding in codebase
6. **Build Docker Images:** Push to controlitfactory/crm registry
7. **Deploy:** Follow step-by-step guide
8. **Test:** Complete UAT checklist
9. **Train Users:** Create accounts and provide training
10. **Monitor:** Set up alerts and regular maintenance

---

## Support Resources

**Documentation:**
- Full Deployment Plan: `/DEPLOYMENT_PLAN.md`
- Repository README: `/README.md`
- Claude Instructions: `/CLAUDE.md`

**Hostinger Support:**
- Panel: https://hpanel.hostinger.com
- Knowledge Base: https://support.hostinger.com
- Live Chat: Available 24/7

**Technology Documentation:**
- NestJS: https://docs.nestjs.com
- React: https://react.dev
- PostgreSQL: https://www.postgresql.org/docs
- Docker: https://docs.docker.com
- Nginx: https://nginx.org/en/docs

---

## Risk Assessment Summary

| Risk | Probability | Impact | Mitigation Status |
|------|-------------|--------|-------------------|
| Data Loss | Low | Critical | ✅ Daily backups configured |
| Server Downtime | Low-Medium | High | ✅ Monitoring + auto-restart |
| Security Breach | Low | Critical | ✅ Multiple layers configured |
| Performance Issues | Medium | Medium | ✅ Monitoring in place |
| Knowledge Loss | Medium | High | ✅ Comprehensive docs |

---

**Document Version:** 1.0
**Created:** 2025-11-12
**Status:** ✅ Ready for Implementation

**For detailed implementation guide, see `/DEPLOYMENT_PLAN.md`**
