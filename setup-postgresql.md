# Quick PostgreSQL Setup

Your app is now configured to use PostgreSQL! Here's how to get it running:

## Option 1: Docker (Easiest)

1. **Install Docker Desktop** if you haven't already
2. **Start PostgreSQL**:
   ```bash
   docker-compose up -d
   ```
3. **Start the server**:
   ```bash
   cd server
   npm start
   ```
4. **Start the client**:
   ```bash
   cd client
   npm start
   ```

## Option 2: Render PostgreSQL (For Deployment)

1. **Create PostgreSQL database on Render**
2. **Set environment variable**: `DATABASE_URL=your_render_postgres_url`
3. **Deploy**: The database will be initialized automatically

## What Changed

✅ **Switched from SQLite to PostgreSQL**
✅ **All database queries updated**
✅ **Parameterized queries for security**
✅ **Better performance for multi-user**
✅ **Data persistence between deployments**

## Database Management

- **pgAdmin**: http://localhost:8080 (admin@example.com / admin)
- **Connection**: `postgresql://postgres:password@localhost:5432/taskmanagement`

## Benefits You Get

- **Data persistence** - No data loss on restarts
- **Multi-user support** - Multiple users can use the app simultaneously
- **Better performance** - Optimized for concurrent access
- **Production ready** - Industry standard database
- **Scalability** - Can handle growth and more users

Your app is now ready for production deployment with data persistence! 



## Database Maintenance Commands

### Connect to PostgreSQL Database
```bash
docker exec -it task-management-db psql -U postgres -d taskmanagement
```

### Clean Up All Data (Reset Database)
**⚠️ Warning: This will permanently delete all data!**
```sql
TRUNCATE users, user_sessions, workspaces, tags, tasks, task_history RESTART IDENTITY CASCADE;
```
**What this does:**
- Removes all data from all tables
- Resets auto-increment counters back to 1
- Maintains table structure for fresh start

### Useful Maintenance Queries

1. **List all tables:**
   ```sql
   \dt
   ```

2. **View table structure:**
   ```sql
   \d workspaces
   \d tasks
   \d tags
   ```

3. **View data in tables:**
   ```sql
   SELECT * FROM workspaces;
   SELECT * FROM tasks;
   SELECT * FROM tags;
   ```

4. **Count records:**
   ```sql
   SELECT COUNT(*) FROM workspaces;
   SELECT COUNT(*) FROM tasks;
   SELECT COUNT(*) FROM tags;
   ```

5. **View tasks with workspace info:**
   ```sql
   SELECT t.*, w.name as workspace_name 
   FROM tasks t 
   JOIN workspaces w ON t.workspace_id = w.id;
   ```

6. **Exit psql:**
   ```sql
   \q
   ```

**Backup database (from host terminal):**
```bash
docker exec task-management-db pg_dump -U postgres taskmanagement > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore database (from host terminal):**
```bash
docker exec -i task-management-db psql -U postgres taskmanagement < backup_filename.sql
```

**Delete all data for a user**
-- Set the email once at the top
\set email_address 'shops9191@gmail.com'

BEGIN;

DELETE FROM filter_conditions 
WHERE filter_id IN (
  SELECT fp.id FROM filter_preferences fp 
  JOIN users u ON fp.user_id = u.id 
  WHERE u.email = :'email_address'
);

DELETE FROM filter_preferences 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM task_assignees 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address') 
   OR assigned_by = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM task_history 
WHERE task_id IN (
  SELECT id FROM tasks 
  WHERE user_id = (SELECT id FROM users WHERE email = :'email_address')
);

DELETE FROM tasks 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM categories 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM tags 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM workspace_permissions 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM workspaces 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM user_sessions 
WHERE user_id = (SELECT id FROM users WHERE email = :'email_address');

DELETE FROM users 
WHERE email = :'email_address';

COMMIT;