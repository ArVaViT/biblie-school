# Financial & Operations — Bible School LMS

**Date:** 2026-02-26  
**Last Updated:** 2026-03-12  
**Scope:** Infrastructure costs, scaling thresholds, optimization strategies

---

## Current Status (2026-03-12)

All services remain within their **free tiers**. Monthly cost is **$0/month**. Despite significant feature additions (announcements, student notes, structured logging, CI/CD pipelines, rate limiting, accessibility improvements, and code splitting), usage remains well below free tier limits. No paid upgrades have been necessary during development.

Key optimizations that help extend free tier headroom:
- **Code splitting** reduces frontend bundle size (less bandwidth per page load)
- **N+1 query fixes** reduce database query volume
- **Rate limiting** prevents runaway API usage
- **File upload validation** (50MB cap, MIME allowlist) prevents storage abuse

**Next cost trigger:** Upgrading to Vercel Pro ($20/mo) + Supabase Pro ($25/mo) will be required before any production/commercial launch.

---

## 1. Current Stack & Costs

| Service | Plan | Monthly Cost | Purpose |
|---------|------|:------------:|---------|
| **Vercel** (Frontend) | Hobby (Free) | $0 | React SPA hosting |
| **Vercel** (Backend) | Hobby (Free) | $0 | FastAPI serverless |
| **Supabase** | Free | $0 | PostgreSQL, Auth, Storage |
| **Brevo** | Free | $0 | SMTP (300 emails/day) |
| **Google Cloud** | Free | $0 | OAuth only (no compute/storage) |
| **GitHub** | Free | $0 | Code hosting |
| **Domain** | N/A | $0 | Using *.vercel.app |
| **Total** | | **$0/month** | |

---

## 2. Free Tier Limits

### Vercel Hobby
| Resource | Limit | Risk at Scale |
|----------|-------|:-------------:|
| Serverless function invocations | 1,000,000/month | Low |
| Function duration | 10s (max 60s) | Medium — cold starts |
| Bandwidth | ~100 GB/month | Low |
| Build minutes | 6,000/month | Low |
| Deployments/day | 100 | Low |
| **Commercial use** | **NOT ALLOWED** | **HIGH** — must upgrade for production |

### Supabase Free
| Resource | Limit | Risk at Scale |
|----------|-------|:-------------:|
| Database size | 500 MB | Medium |
| File storage | 1 GB | Medium — course materials |
| Bandwidth | 5 GB/month | HIGH — first bottleneck |
| MAUs (auth) | 50,000 | Low |
| Edge functions | 500K invocations | Low (not used) |
| **Inactivity pause** | **7 days** | **HIGH** — project pauses if unused |
| Realtime connections | 200 concurrent | Low |
| Daily backups | None on free | HIGH — no recovery |

### Brevo Free
| Resource | Limit |
|----------|-------|
| Emails/day | 300 |
| Emails/month | ~9,000 |
| Contact limit | Unlimited |

---

## 3. Scaling Cost Projections

### Assumptions
- Average student: 5 API calls/session, 2 sessions/week, ~5 MB bandwidth/month
- Average teacher: 20 API calls/session, 3 sessions/week, ~15 MB bandwidth/month
- Course materials: ~50 MB average per course
- Ratio: 90% students, 8% teachers, 2% admin

### Cost by User Count

| Users (MAU) | Vercel | Supabase | Brevo | Total/month |
|:-----------:|:------:|:--------:|:-----:|:-----------:|
| **50** | $0 | $0 | $0 | **$0** |
| **100** | $0 | $0 | $0 | **$0** |
| **500** | $0 | $0 | $0 | **$0** |
| **1,000** | $0* | $0–25† | $0 | **$0–25** |
| **2,500** | $20 | $25 | $0 | **$45** |
| **5,000** | $20 | $25 | $25‡ | **$70** |
| **10,000** | $20+usage | $25+usage | $25 | **$100–150** |

\* Vercel Hobby prohibits commercial use. Must upgrade to Pro ($20/mo) for any production deployment.  
† Supabase bandwidth (5 GB) likely exceeded at ~800–1,000 active users. Pro plan: $25/mo.  
‡ Brevo free (300/day = 9K/month) exceeded if sending enrollment confirmations to all.

### Key Thresholds

| Trigger | What Happens | Cost Impact |
|---------|--------------|:-----------:|
| **First real user** | Must upgrade Vercel to Pro (commercial use) | +$20/mo |
| **~800 MAU** | Supabase bandwidth limit hit | +$25/mo |
| **~1 GB materials** | Supabase storage limit hit | Already on Pro |
| **~300 emails/day** | Brevo limit hit | +$25/mo or switch |
| **~50 courses** | Database approaching 500 MB | Already on Pro |

---

## 4. Optimization Strategies

### 4.1 Bandwidth Reduction (Biggest Savings)
| Strategy | Savings | Effort |
|----------|:-------:|:------:|
| Add `Cache-Control` headers to course listings | 30–40% | Low |
| Serve images via Supabase CDN with transforms | 20–30% | Low |
| Compress API responses (gzip/brotli) | 15–20% | Low |
| Frontend code splitting (reduce initial load) | 10–15% | Medium |

### 4.2 Database Optimization
| Strategy | Savings | Effort |
|----------|:-------:|:------:|
| Fix N+1 queries (joinedload) | 80% fewer queries | Low |
| Add missing indexes | Faster reads | Low |
| Connection pooling via Supabase Pooler | Fewer connections | Low |
| Archive old enrollments (if needed) | Reduce DB size | Medium |

### 4.3 Storage Optimization
| Strategy | Savings | Effort |
|----------|:-------:|:------:|
| Compress images on upload (client-side) | 50–70% less storage | Medium |
| Set max dimensions for avatars (200x200) | 90% less per avatar | Low |
| Limit course materials to PDF only | Clearer, smaller | Policy |

---

## 5. Recommended Budget Timeline

### Immediate (Now)
- **$0/month** — Stay on free tiers during development
- ⚠️ Supabase project will pause after 7 days of inactivity — keep a cron ping or upgrade

### Pre-Launch
- **$45/month** — Vercel Pro ($20) + Supabase Pro ($25)
- Enables: commercial use, no pause, backups, 8 GB bandwidth, 1 GB storage

### Growth (500+ users)
- **$45–70/month** — Same stack, Brevo upgrade if needed
- Monitor: bandwidth usage, database size, email volume

### Scale (5,000+ users)
- **$100–150/month** — Usage-based overages
- Consider: dedicated database, CDN for static assets, email service upgrade

---

## 6. Infrastructure Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Supabase project pause (7-day inactivity) | HIGH | App goes offline | Upgrade to Pro or add keep-alive cron |
| Vercel cold starts (1–3s for Python) | HIGH | Slow first request | Accept for now; consider Edge functions later |
| No backups | HIGH | Data loss on incident | Upgrade Supabase for daily backups |
| No error tracking | HIGH | Bugs go unnoticed | Add Sentry (free tier: 5K events/month) |
| No monitoring | HIGH | Downtime undetected | Add UptimeRobot (free: 50 monitors) |
| Single region (Supabase) | LOW | Latency for distant users | Accept for Bible School scale |

---

## 7. Recommended First Spend

When ready to go live:

| Item | Cost | Why |
|------|:----:|-----|
| Vercel Pro | $20/mo | Commercial use license, no deploy limits |
| Supabase Pro | $25/mo | No pause, backups, 8 GB bandwidth |
| Custom domain | $10–15/yr | Professional appearance |
| Sentry (free) | $0 | Error tracking |
| UptimeRobot (free) | $0 | Uptime monitoring |
| **Total** | **~$46/month** | Production-ready infrastructure |

This is the minimum viable infrastructure spend for a production deployment.
