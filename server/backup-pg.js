const { Pool } = require('pg');
const moment = require('moment-timezone');

class PostgreSQLBackupManager {
  constructor(options = {}) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/taskmanagement',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Configuration options
    this.config = {
      safetyThreshold: options.safetyThreshold || 10, // Keep all backups if total <= this number
      maxTodayBackups: options.maxTodayBackups || 10, // Max backups to keep from today
      dailyRetentionDays: options.dailyRetentionDays || 7, // Days to keep daily backups
      weeklyRetentionDays: options.weeklyRetentionDays || 30, // Days to keep weekly backups
      ...options
    };
  }

  // Calculate hash of current database content
  async calculateDatabaseHash() {
    const client = await this.pool.connect();
    try {
      const tables = ['tasks', 'tags', 'task_history', 'workspaces'];
      const tableData = {};
      
      for (const table of tables) {
        const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
        tableData[table] = JSON.stringify(result.rows, null, 2);
      }
      
      // Create hash of all table data
      const crypto = require('crypto');
      const combinedData = JSON.stringify(tableData, null, 2);
      const hash = crypto.createHash('sha256').update(combinedData).digest('hex');
      return hash;
    } finally {
      client.release();
    }
  }

  // Get last backup metadata
  getLastBackupMetadata() {
    try {
      const fs = require('fs');
      const path = require('path');
      const metadataFile = path.join(__dirname, 'backup-metadata.json');
      
      if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error reading backup metadata:', error.message);
      return null;
    }
  }

  // Save backup metadata
  saveBackupMetadata(backupTablePrefix, databaseHash) {
    const metadata = {
      lastBackup: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      }),
      backupTablePrefix: backupTablePrefix,
      databaseHash: databaseHash,
      version: '2.0'
    };
    
    try {
      const fs = require('fs');
      const path = require('path');
      const metadataFile = path.join(__dirname, 'backup-metadata.json');
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Error saving backup metadata:', error.message);
    }
  }

  // Create backup tables in the same database
  async createBackup() {
    const client = await this.pool.connect();
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, '_').replace(/\..+/, '').replace('T', '_');
      
      const backupPrefix = `backup_${timestamp}`;
      
      // Create backup tables with data
      const tables = [
        { name: 'workspaces', columns: 'id, name, description, created_at, updated_at' },
        { name: 'categories', columns: 'id, name, workspace_id, hidden, created_at, updated_at' },
        { name: 'tasks', columns: 'id, user_id, workspace_id, title, description, category_id, priority, status, due_date, start_date, completion_date, last_modified, created_at' },
        { name: 'task_history', columns: 'id, task_id, status, action_date, notes' }
      ];
      
      for (const table of tables) {
        const backupTableName = `${backupPrefix}_${table.name}`;
        
        // Create backup table with same structure
        await client.query(`
          CREATE TABLE ${backupTableName} AS 
          SELECT * FROM ${table.name}
        `);
        
        console.log(`Created backup table: ${backupTableName}`);
      }
      
      return backupPrefix;
    } finally {
      client.release();
    }
  }

  // Check if backup is needed by comparing current hash with last backup hash
  async isBackupNeeded() {
    try {
      const currentHash = await this.calculateDatabaseHash();
      const lastMetadata = this.getLastBackupMetadata();
      
      if (!lastMetadata || !lastMetadata.databaseHash) {
        console.log('No previous backup found, backup needed');
        return { needed: true, reason: 'No previous backup' };
      }
      
      if (currentHash !== lastMetadata.databaseHash) {
        console.log('Database has changed since last backup, backup needed');
        return { needed: true, reason: 'Database content changed' };
      }
      
      console.log('No changes detected since last backup, skipping backup');
      return { needed: false, reason: 'No changes detected' };
    } catch (error) {
      console.error('Error checking if backup is needed:', error.message);
      // If we can't determine, err on the side of caution and create backup
      return { needed: true, reason: 'Error checking changes, creating backup for safety' };
    }
  }

  // Perform automatic backup with change detection
  async performAutomaticBackup() {
    try {
      console.log('Checking if backup is needed...');
      const backupCheck = await this.isBackupNeeded();
      
      if (!backupCheck.needed) {
        console.log(`Backup skipped: ${backupCheck.reason}`);
        return { success: true, skipped: true, reason: backupCheck.reason };
      }
      
      console.log(`Creating backup: ${backupCheck.reason}`);
      const backupPrefix = await this.createBackup();
      const databaseHash = await this.calculateDatabaseHash();
      
      this.saveBackupMetadata(backupPrefix, databaseHash);
      
      // Clean up old backups (keep last 10)
      await this.cleanupOldBackups();
      
      console.log(`Backup created successfully: ${backupPrefix}`);
      return { 
        success: true, 
        skipped: false, 
        backupPrefix: backupPrefix,
        reason: backupCheck.reason 
      };
      
    } catch (error) {
      console.error('Backup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Clean up old backups with tiered retention policy
  async cleanupOldBackups() {
    const client = await this.pool.connect();
    try {
      // Get all backup tables
      const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'backup_%'
        ORDER BY table_name DESC
      `);
      
      const backupTables = result.rows;
      
      // Helper to extract date from table name
      function extractDateFromTableName(tableName) {
        // backup_YYYY_MM_DD_HH_MM_SS_xxx
        const match = tableName.match(/^backup_(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
        if (!match) return null;
        const [ , year, month, day, hour, minute, second ] = match;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
      }
      
      // Group backups by prefix and extract dates
      const backupSets = new Map();
      backupTables.forEach(row => {
        const prefix = row.table_name.split('_').slice(0, -1).join('_');
        const created = extractDateFromTableName(row.table_name);
        if (!backupSets.has(prefix)) {
          backupSets.set(prefix, {
            prefix: prefix,
            tables: [],
            created: created
          });
        }
        backupSets.get(prefix).tables.push(row.table_name);
      });
      
      const sortedBackupSets = Array.from(backupSets.values())
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      // Safety check: if we have few backups total, keep them all
      // This prevents accidental deletion when you have very few backups
      if (sortedBackupSets.length <= this.config.safetyThreshold) {
        console.log(`Keeping all ${sortedBackupSets.length} backups (safety threshold: ${this.config.safetyThreshold})`);
        return;
      }
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dailyRetentionAgo = new Date(today.getTime() - this.config.dailyRetentionDays * 24 * 60 * 60 * 1000);
      const weeklyRetentionAgo = new Date(today.getTime() - this.config.weeklyRetentionDays * 24 * 60 * 60 * 1000);
      
      // Separate backups by time periods
      const todayBackups = [];
      const pastWeekBackups = [];
      const pastMonthBackups = [];
      const olderBackups = [];
      
      sortedBackupSets.forEach(backup => {
        const backupDate = new Date(backup.created);
        const backupDay = new Date(backupDate.getFullYear(), backupDate.getMonth(), backupDate.getDate());
        
        if (backupDay.getTime() === today.getTime()) {
          todayBackups.push(backup);
        } else if (backupDay >= dailyRetentionAgo) {
          pastWeekBackups.push(backup);
        } else if (backupDay >= weeklyRetentionAgo) {
          pastMonthBackups.push(backup);
        } else {
          olderBackups.push(backup);
        }
      });
      
      // Apply retention policy
      const backupsToKeep = new Set();
      
      // Keep up to 10 backups from today
      todayBackups.slice(0, 10).forEach(backup => {
        backupsToKeep.add(backup.prefix);
      });
      
      // Keep 1 backup per day for the past week (excluding today)
      const dailyBackups = this.getOneBackupPerDay(pastWeekBackups);
      dailyBackups.forEach(backup => {
        backupsToKeep.add(backup.prefix);
      });
      
      // Keep 1 backup per week for the past month (older than 7 days)
      const weeklyBackups = this.getOneBackupPerWeek(pastMonthBackups);
      weeklyBackups.forEach(backup => {
        backupsToKeep.add(backup.prefix);
      });
      
      // Delete backups not in the keep list
      const backupsToDelete = sortedBackupSets.filter(backup => !backupsToKeep.has(backup.prefix));
      
      for (const backup of backupsToDelete) {
        for (const table of backup.tables) {
          await client.query(`DROP TABLE IF EXISTS ${table}`);
          console.log(`Deleted old backup table: ${table}`);
        }
      }
      
      console.log(`Backup cleanup completed. Kept ${backupsToKeep.size} backup sets, deleted ${backupsToDelete.length} backup sets.`);
      
    } catch (error) {
      console.warn('Error cleaning up old backups:', error.message);
    } finally {
      client.release();
    }
  }
  
  // Get one backup per day from a list of backups
  getOneBackupPerDay(backups) {
    const dailyBackups = new Map();
    
    backups.forEach(backup => {
      const backupDate = new Date(backup.created);
      const dayKey = backupDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!dailyBackups.has(dayKey) || backupDate > new Date(dailyBackups.get(dayKey).created)) {
        dailyBackups.set(dayKey, backup);
      }
    });
    
    return Array.from(dailyBackups.values());
  }
  
  // Get one backup per week from a list of backups
  getOneBackupPerWeek(backups) {
    const weeklyBackups = new Map();
    
    backups.forEach(backup => {
      const backupDate = new Date(backup.created);
      const weekKey = this.getWeekKey(backupDate);
      
      if (!weeklyBackups.has(weekKey) || backupDate > new Date(weeklyBackups.get(weekKey).created)) {
        weeklyBackups.set(weekKey, backup);
      }
    });
    
    return Array.from(weeklyBackups.values());
  }
  
  // Get week key (YYYY-WW format)
  getWeekKey(date) {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  // Get backup statistics with retention policy breakdown
  async getBackupStats() {
    const client = await this.pool.connect();
    try {
      // Get all backup tables with creation dates
      const result = await client.query(`
        SELECT table_name, 
               created_at
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'backup_%'
        ORDER BY table_name DESC
      `);
      
      const backupTables = result.rows;
      
      // Group backups by prefix and extract dates
      const backupSets = new Map();
      backupTables.forEach(row => {
        const prefix = row.table_name.split('_').slice(0, -1).join('_');
        if (!backupSets.has(prefix)) {
          backupSets.set(prefix, {
            prefix: prefix,
            tables: [],
            created: row.created_at
          });
        }
        backupSets.get(prefix).tables.push(row.table_name);
      });
      
      const sortedBackupSets = Array.from(backupSets.values())
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      
      // Calculate retention policy breakdown
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dailyRetentionAgo = new Date(today.getTime() - this.config.dailyRetentionDays * 24 * 60 * 60 * 1000);
      const weeklyRetentionAgo = new Date(today.getTime() - this.config.weeklyRetentionDays * 24 * 60 * 60 * 1000);
      
      const todayBackups = [];
      const pastWeekBackups = [];
      const pastMonthBackups = [];
      const olderBackups = [];
      
      sortedBackupSets.forEach(backup => {
        const backupDate = new Date(backup.created);
        const backupDay = new Date(backupDate.getFullYear(), backupDate.getMonth(), backupDate.getDate());
        
        if (backupDay.getTime() === today.getTime()) {
          todayBackups.push(backup);
        } else if (backupDay >= dailyRetentionAgo) {
          pastWeekBackups.push(backup);
        } else if (backupDay >= weeklyRetentionAgo) {
          pastMonthBackups.push(backup);
        } else {
          olderBackups.push(backup);
        }
      });
      
      const lastMetadata = this.getLastBackupMetadata();
      
      return {
        totalBackups: sortedBackupSets.length,
        totalTables: backupTables.length,
        lastBackup: lastMetadata ? lastMetadata.lastBackup : null,
        retentionPolicy: {
          today: {
            count: todayBackups.length,
            maxAllowed: 10,
            backups: todayBackups.map(b => ({ prefix: b.prefix, created: b.created }))
          },
          pastWeek: {
            count: pastWeekBackups.length,
            dailyBackups: this.getOneBackupPerDay(pastWeekBackups).length,
            backups: this.getOneBackupPerDay(pastWeekBackups).map(b => ({ prefix: b.prefix, created: b.created }))
          },
          pastMonth: {
            count: pastMonthBackups.length,
            weeklyBackups: this.getOneBackupPerWeek(pastMonthBackups).length,
            backups: this.getOneBackupPerWeek(pastMonthBackups).map(b => ({ prefix: b.prefix, created: b.created }))
          },
          older: {
            count: olderBackups.length,
            backups: olderBackups.map(b => ({ prefix: b.prefix, created: b.created }))
          }
        },
        backupTables: backupTables.map(row => row.table_name)
      };
    } catch (error) {
      console.error('Error getting backup stats:', error.message);
      return null;
    } finally {
      client.release();
    }
  }

  // List all backups
  async listBackups() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT table_name, 
               created_at
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'backup_%'
        ORDER BY table_name DESC
      `);
      
      const backupSets = new Map();
      
      result.rows.forEach(row => {
        const prefix = row.table_name.split('_').slice(0, -1).join('_');
        if (!backupSets.has(prefix)) {
          backupSets.set(prefix, {
            prefix: prefix,
            tables: [],
            created: row.created_at
          });
        }
        backupSets.get(prefix).tables.push(row.table_name);
      });
      
      return Array.from(backupSets.values());
    } finally {
      client.release();
    }
  }

  // Restore from backup
  async restoreFromBackup(backupPrefix) {
    const client = await this.pool.connect();
    try {
      // Verify backup exists
      const backupTables = [
        `${backupPrefix}_workspaces`,
        `${backupPrefix}_tags`, 
        `${backupPrefix}_tasks`,
        `${backupPrefix}_task_history`
      ];
      
      for (const table of backupTables) {
        const exists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [table]);
        
        if (!exists.rows[0].exists) {
          throw new Error(`Backup table ${table} not found`);
        }
      }
      
      // Begin transaction
      await client.query('BEGIN');
      
      try {
        // Clear current tables
        await client.query('DELETE FROM task_history');
        await client.query('DELETE FROM tasks');
        await client.query('DELETE FROM tags');
        await client.query('DELETE FROM workspaces');
        
        // Restore from backup tables
        await client.query(`INSERT INTO workspaces SELECT * FROM ${backupPrefix}_workspaces`);
        await client.query(`INSERT INTO tags SELECT * FROM ${backupPrefix}_tags`);
        await client.query(`INSERT INTO tasks SELECT * FROM ${backupPrefix}_tasks`);
        await client.query(`INSERT INTO task_history SELECT * FROM ${backupPrefix}_task_history`);
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log(`Successfully restored from backup: ${backupPrefix}`);
        return { success: true, backupPrefix };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      
    } finally {
      client.release();
    }
  }
}

module.exports = PostgreSQLBackupManager; 