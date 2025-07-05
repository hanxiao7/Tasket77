const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./database');

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
    this.metadataFile = path.join(this.backupDir, 'backup-metadata.json');
    this.ensureBackupDirectory();
  }

  // Ensure backup directory exists
  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Calculate hash of current database content
  async calculateDatabaseHash() {
    return new Promise((resolve, reject) => {
      const tables = ['tasks', 'tags', 'task_history'];
      const tableData = {};
      
      let completedTables = 0;
      
      tables.forEach(table => {
        db.all(`SELECT * FROM ${table} ORDER BY id`, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Convert rows to string for hashing
          const tableString = JSON.stringify(rows, null, 2);
          tableData[table] = tableString;
          
          completedTables++;
          if (completedTables === tables.length) {
            // Create hash of all table data
            const combinedData = JSON.stringify(tableData, null, 2);
            const hash = crypto.createHash('sha256').update(combinedData).digest('hex');
            resolve(hash);
          }
        });
      });
    });
  }

  // Get last backup metadata
  getLastBackupMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
        return metadata;
      }
    } catch (error) {
      console.warn('Error reading backup metadata:', error.message);
    }
    return null;
  }

  // Save backup metadata
  saveBackupMetadata(backupPath, databaseHash) {
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
      backupPath: backupPath,
      databaseHash: databaseHash,
      version: '1.0'
    };
    
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('Error saving backup metadata:', error.message);
    }
  }

  // Create backup of the database
  async createBackup() {
    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[/:]/g, '-').replace(/,/g, '');
    const backupPath = path.join(this.backupDir, `tasks-backup-${timestamp}.db`);
    
    return new Promise((resolve, reject) => {
      // Create a backup by copying the database file
      const sourcePath = path.join(__dirname, 'tasks.db');
      
      if (!fs.existsSync(sourcePath)) {
        reject(new Error('Database file not found'));
        return;
      }
      
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(backupPath);
      
      readStream.on('error', (error) => {
        reject(error);
      });
      
      writeStream.on('error', (error) => {
        reject(error);
      });
      
      writeStream.on('finish', () => {
        resolve(backupPath);
      });
      
      readStream.pipe(writeStream);
    });
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
      const backupPath = await this.createBackup();
      const databaseHash = await this.calculateDatabaseHash();
      
      this.saveBackupMetadata(backupPath, databaseHash);
      
      // Clean up old backups (keep last 10)
      await this.cleanupOldBackups();
      
      console.log(`Backup created successfully: ${path.basename(backupPath)}`);
      return { 
        success: true, 
        skipped: false, 
        backupPath: backupPath,
        reason: backupCheck.reason 
      };
      
    } catch (error) {
      console.error('Backup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Clean up old backups, keeping only the last 10
  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('tasks-backup-') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          stats: fs.statSync(path.join(this.backupDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
      
      // Keep only the last 10 backups
      if (files.length > 10) {
        const filesToDelete = files.slice(10);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            console.log(`Deleted old backup: ${file.name}`);
          } catch (error) {
            console.warn(`Failed to delete old backup ${file.name}:`, error.message);
          }
        });
      }
    } catch (error) {
      console.warn('Error cleaning up old backups:', error.message);
    }
  }

  // Get backup statistics
  getBackupStats() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('tasks-backup-') && file.endsWith('.db'));
      
      const totalSize = files.reduce((size, file) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return size + stats.size;
      }, 0);
      
      const lastMetadata = this.getLastBackupMetadata();
      
      return {
        totalBackups: files.length,
        totalSize: totalSize,
        lastBackup: lastMetadata ? lastMetadata.lastBackup : null,
        backupDirectory: this.backupDir
      };
    } catch (error) {
      console.error('Error getting backup stats:', error.message);
      return null;
    }
  }
}

module.exports = BackupManager; 