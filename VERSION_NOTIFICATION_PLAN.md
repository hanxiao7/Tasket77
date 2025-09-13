# Version Notification System Plan

## Overview
Implement a notification system to inform users about important updates (bug fixes and major changes) when they first access the app after a new deployment.

## Database Changes

### 1. Create app_versions table
```sql
CREATE TABLE app_versions (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,  -- e.g., "1.2.3"
  release_notes TEXT,            -- Manual message from developer
  is_notification_worthy BOOLEAN DEFAULT false,  -- Only show for important updates
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Add version tracking to users table
```sql
ALTER TABLE users ADD COLUMN last_seen_version VARCHAR(20);
```

## Backend Changes

### 1. Add version endpoints to server/index.js
- `GET /api/version` - Returns current app version and latest notification-worthy version
- `POST /api/version/seen` - Marks version as seen by user

### 2. Version checking logic
- Compare user's `last_seen_version` with latest `is_notification_worthy = true` version
- Return notification data if user hasn't seen latest version

## Frontend Changes

### 1. Create notification component
- Banner/modal showing version and release notes
- Dismissible with "Got it!" button
- Clean, non-intrusive design

### 2. Add version checking to App.tsx
- Check for new version on app load/login
- Show notification if new version available
- Call API to mark as seen when dismissed

## Version Management

### 1. Version numbering (Semantic Versioning)
- Format: `MAJOR.MINOR.PATCH` (e.g., 1.2.3)
- MAJOR: Breaking changes, major features
- MINOR: New features, backwards compatible
- PATCH: Bug fixes, backwards compatible

### 2. Version storage
- Hardcode version in both client and server code
- Database `app_versions` table is source of truth for notifications
- No need to update package.json

## Deployment Workflow

### 1. When deploying updates:
1. Update version string in both client and server code
2. Add entry to `app_versions` table with release notes
3. Set `is_notification_worthy = true` for important updates
4. Deploy as usual

### 2. For non-notification updates:
- Still increment version number
- Set `is_notification_worthy = false` in database
- No notification shown to users

## User Experience

### 1. Notification behavior
- Only shows latest version notification (not all missed versions)
- Shows on first app load after deployment
- Dismissible, won't show again until next important update
- Works across all user devices (server-side tracking)

### 2. Notification content
- Version number (e.g., "What's New in v1.2.3")
- Manual release notes from developer
- Clean, professional appearance

## Implementation Effort
- **Database**: 1 table + 1 column addition
- **Backend**: ~50 lines of code, 2 API endpoints
- **Frontend**: 1 notification component + version checking logic
- **Total time**: 2-3 hours

## Benefits
- Users stay informed about important updates
- Developer controls when notifications appear
- Cross-device consistency
- Simple, maintainable system
- No localStorage dependency
