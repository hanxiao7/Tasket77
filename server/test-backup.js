const PostgreSQLBackupManager = require('./backup-pg');

async function testBackupSystem() {
  console.log('🧪 Testing PostgreSQL Backup System with Tiered Retention Policy\n');
  
  const backupManager = new PostgreSQLBackupManager();
  
  try {
    // Test 1: Get current backup stats
    console.log('1. Getting current backup statistics...');
    const stats = await backupManager.getBackupStats();
    console.log('Current stats:', JSON.stringify(stats, null, 2));
    console.log('');
    
    // Test 2: Create a backup
    console.log('2. Creating a backup...');
    const backupResult = await backupManager.performAutomaticBackup();
    console.log('Backup result:', backupResult);
    console.log('');
    
    // Test 3: List all backups
    console.log('3. Listing all backups...');
    const backups = await backupManager.listBackups();
    console.log('Available backups:', backups);
    console.log('');
    
    // Test 4: Get updated stats with retention breakdown
    console.log('4. Getting updated backup statistics with retention policy...');
    const updatedStats = await backupManager.getBackupStats();
    console.log('Updated stats:', JSON.stringify(updatedStats, null, 2));
    console.log('');
    
    // Test 5: Show retention policy summary
    console.log('5. Retention Policy Summary:');
    if (updatedStats.retentionPolicy) {
      const rp = updatedStats.retentionPolicy;
      console.log(`   Today: ${rp.today.count}/${rp.today.maxAllowed} backups`);
      console.log(`   Past Week: ${rp.pastWeek.dailyBackups} daily backups (from ${rp.pastWeek.count} total)`);
      console.log(`   Past Month: ${rp.pastMonth.weeklyBackups} weekly backups (from ${rp.pastMonth.count} total)`);
      console.log(`   Older: ${rp.older.count} backups (will be cleaned up)`);
    }
    console.log('');
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close the pool
    await backupManager.pool.end();
  }
}

// Run the test
testBackupSystem(); 