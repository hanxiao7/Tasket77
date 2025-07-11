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