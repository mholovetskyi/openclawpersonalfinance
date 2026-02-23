# ClawFinance Enhancement Plan — Bulletproof, Customizable, Local-First, Safe, Personalized

## Current State Assessment

The project has a solid foundation: Express API with PostgreSQL, React UI with Tailwind/Recharts,
7 MCP servers, Docker Compose stack, comprehensive E2E tests. But several critical areas need
hardening to make this truly bulletproof.

### Gaps Identified

1. **Security**: Auth bypasses when no API key set; no rate limiting; no input sanitization via
   Zod on route handlers; no CSRF protection; tax file upload has no file type validation beyond
   multer; WebSocket has no authentication; DB queries use string interpolation in some spots
2. **Customizability**: No user preferences system; no theming; no configurable dashboard layout;
   no custom categories; no currency/locale support; hardcoded USD everywhere
3. **Local-first safety**: Data encryption at rest is schema-ready (pgcrypto) but not used on
   sensitive fields; no data export/backup; no offline capability; no local-only mode toggle
4. **Personalization**: Single hardcoded user_id; no financial goals; no custom alert thresholds;
   no personalized insights based on spending patterns
5. **Robustness**: No request validation with Zod (despite having it as a dependency); no
   graceful error boundaries in React; no retry logic on API calls; no data migration tooling

---

## Implementation Plan (13 Deliverables)

### Phase 1: Security Hardening

**1. Input Validation Layer (Zod)**
- Add Zod schemas for every route's request params, query, and body
- Create a `validate` middleware that rejects malformed requests with 400
- Files: `clawfinance/api/src/middleware/validate.ts`, update all routes

**2. Rate Limiting & Security Headers**
- Add express-rate-limit middleware (100 req/min default, 5/min for auth-sensitive)
- Add helmet for security headers (CSP, HSTS, X-Frame-Options)
- Add CSRF token support for state-changing endpoints
- Files: `clawfinance/api/src/middleware/rateLimit.ts`, `clawfinance/api/src/middleware/security.ts`

**3. WebSocket Authentication**
- Require API key on WebSocket upgrade handshake
- Add connection-level rate limiting
- Files: `clawfinance/api/src/services/websocket.ts`

**4. File Upload Hardening**
- Validate file magic bytes (not just extension) for tax uploads
- Add virus scan hook point
- Restrict upload paths to prevent path traversal
- Files: `clawfinance/api/src/middleware/uploadSecurity.ts`, update `routes/tax.ts`

### Phase 2: Customization & Personalization

**5. User Preferences System**
- New DB migration for `user_preferences` table
- API endpoints: GET/PUT `/api/preferences`
- Preferences: currency, locale, date format, theme, dashboard layout, default date range
- Files: `clawfinance/db/migrations/018_create_user_preferences.sql`,
  `clawfinance/api/src/routes/preferences.ts`

**6. Custom Transaction Categories**
- New DB migration for `custom_categories` table
- CRUD endpoints for user-defined categories with colors and icons
- Auto-categorization rules (regex patterns on merchant names)
- Files: `clawfinance/db/migrations/019_create_custom_categories.sql`,
  `clawfinance/api/src/routes/categories.ts`

**7. Financial Goals System**
- New DB migration for `financial_goals` table
- Goals types: savings target, debt payoff, investment milestone, emergency fund
- Progress tracking with projected completion dates
- API endpoints: CRUD `/api/goals`
- Files: `clawfinance/db/migrations/020_create_financial_goals.sql`,
  `clawfinance/api/src/routes/goals.ts`

### Phase 3: Local-First & Data Safety

**8. Data Export & Backup**
- Export all user data as encrypted JSON bundle or CSV
- Import from backup to restore
- Scheduled auto-backup to local filesystem
- API endpoints: POST `/api/data/export`, POST `/api/data/import`
- Files: `clawfinance/api/src/routes/data.ts`, `clawfinance/api/src/services/backup.ts`

**9. Sensitive Field Encryption**
- Encrypt PII fields at rest using pgcrypto (already installed)
- Fields: account names, merchant names, notes, file paths
- Transparent encrypt/decrypt in the DB service layer
- Files: `clawfinance/api/src/services/encryption.ts`, `clawfinance/db/migrations/021_add_field_encryption.sql`

### Phase 4: Enhanced UI

**10. Settings Page Enhancement — Preferences UI**
- Add preferences panel to Settings page (currency, locale, theme, date format)
- Add financial goals management UI
- Add custom categories management UI
- Add data export/import controls
- Files: `clawfinance/ui/src/pages/Settings.tsx`

**11. Dashboard Goals Widget & Error Boundaries**
- Add goals progress widget to NetWorthDashboard
- Add React error boundaries around every page
- Add retry logic with exponential backoff in api.ts
- Files: `clawfinance/ui/src/components/ErrorBoundary.tsx`,
  `clawfinance/ui/src/pages/NetWorthDashboard.tsx`, `clawfinance/ui/src/lib/api.ts`

### Phase 5: Testing & Robustness

**12. Comprehensive Test Coverage**
- Unit tests for all new middleware (validation, rate limit, security)
- Unit tests for preferences, categories, goals routes
- Integration test for data export/import round-trip
- Files: `clawfinance/api/src/__tests__/`

**13. Audit Logging**
- Log all data access and mutations with timestamps and source
- New `audit_log` table for compliance-grade traceability
- Files: `clawfinance/db/migrations/022_create_audit_log.sql`,
  `clawfinance/api/src/middleware/audit.ts`
