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


## View SQL tables

** Connect to PostgreSQL via Terminal

docker exec -it task-management-db psql -U postgres -d taskmanagement

Perfect! You're now connected to the PostgreSQL database. You should see the prompt `taskmanagement=#` which means you're connected and ready to run commands.

## Useful psql Commands to Run:

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

## Quick Commands to Try:
Start with these to see your data:

```sql
\dt
SELECT * FROM workspaces;
SELECT * FROM tasks;
```

Just type these commands in the terminal where you see the `taskmanagement=#` prompt and press Enter. The `\dt` command will show you all your tables, and the SELECT statements will show you the actual data.

Let me know what you see when you run these commands!

