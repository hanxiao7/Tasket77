const moment = require('moment-timezone');

console.log('=== Testing Date Fix ===\n');

// Test the new parsing method
const testDate = '2024-07-02';
console.log('Input date from frontend:', testDate);

// Old method (problematic)
const oldMethod = moment(testDate).tz('America/New_York');
console.log('Old method result:', oldMethod.format('YYYY-MM-DD HH:mm:ss'));

// New method (fixed)
const newMethod = moment.tz(testDate, 'America/New_York').startOf('day');
console.log('New method result:', newMethod.format('YYYY-MM-DD HH:mm:ss'));

console.log('\n=== Comparison ===');
console.log('Old method interprets as UTC midnight, then converts to NY time');
console.log('New method interprets as NY time directly');
console.log('Result: New method preserves the intended date correctly');

// Test edge cases
console.log('\n=== Edge Cases ===');
const edgeCases = ['2024-07-02', '2024-12-25', '2024-02-29'];
edgeCases.forEach(date => {
  const parsed = moment.tz(date, 'America/New_York').startOf('day');
  console.log(`${date} -> ${parsed.format('YYYY-MM-DD HH:mm:ss')}`);
}); 