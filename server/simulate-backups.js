const PostgreSQLBackupManager = require('./backup-pg');

async function simulateBackups() {
  console.log('🔄 Simulating Backup Creation with Tiered Retention Policy\n');
  
  const backupManager = new PostgreSQLBackupManager();
  
  try {
    // Show initial state
    console.log('Initial backup statistics:');
    const initialStats = await backupManager.getBackupStats();
    console.log(JSON.stringify(initialStats, null, 2));
    console.log('');
    
    // Create multiple backups to test retention policy
    console.log('Creating multiple backups...');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`Creating backup ${i}/5...`);
      
      // Create backup tables with different timestamps
      const client = await backupManager.pool.connect();
      try {
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
        
        const backupPrefix = `backup_${timestamp}_test${i}`;
        
        // Create a simple backup table
        await client.query(`
          CREATE TABLE ${backupPrefix}_test AS 
          SELECT 'test backup ${i}' as description, NOW() as created_at
        `);
        
        console.log(`Created test backup: ${backupPrefix}_test`);
        
        // Wait a bit between backups
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } finally {
        client.release();
      }
    }
    
    console.log('');
    
    // Show stats after creating backups
    console.log('Backup statistics after creating test backups:');
    const afterStats = await backupManager.getBackupStats();
    console.log(JSON.stringify(afterStats, null, 2));
    console.log('');
    
    // Test cleanup
    console.log('Testing cleanup with retention policy...');
    await backupManager.cleanupOldBackups();
    console.log('');
    
    // Show final stats
    console.log('Final backup statistics after cleanup:');
    const finalStats = await backupManager.getBackupStats();
    console.log(JSON.stringify(finalStats, null, 2));
    console.log('');
    
    // Show retention policy summary
    console.log('Retention Policy Summary:');
    if (finalStats.retentionPolicy) {
      const rp = finalStats.retentionPolicy;
      console.log(`   Today: ${rp.today.count}/${rp.today.maxAllowed} backups`);
      console.log(`   Past Week: ${rp.pastWeek.dailyBackups} daily backups (from ${rp.pastWeek.count} total)`);
      console.log(`   Past Month: ${rp.pastMonth.weeklyBackups} weekly backups (from ${rp.pastMonth.count} total)`);
      console.log(`   Older: ${rp.older.count} backups (will be cleaned up)`);
    }
    
    console.log('\n✅ Simulation completed successfully!');
    
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    // Close the pool
    await backupManager.pool.end();
  }
}

// Run the simulation
simulateBackups(); 