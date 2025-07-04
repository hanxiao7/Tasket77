const moment = require('moment-timezone');

console.log('=== Date Timezone Debug Test ===\n');

// Test 1: What happens when we receive a date from frontend
console.log('Test 1: Frontend date processing');
const frontendDate = '2024-07-02'; // This is what the frontend sends
console.log('Frontend sends:', frontendDate);

// Test 2: How moment-timezone processes it
console.log('\nTest 2: Moment timezone processing');
const momentDate = moment(frontendDate).tz('America/New_York');
console.log('Moment parsed date:', momentDate.format('YYYY-MM-DD'));
console.log('Moment full date:', momentDate.format('YYYY-MM-DD HH:mm:ss'));
console.log('Moment ISO string:', momentDate.toISOString());

// Test 3: What happens when we save to database
console.log('\nTest 3: Database save format');
const dbFormat = momentDate.format('YYYY-MM-DD HH:mm:ss');
console.log('Saved to DB as:', dbFormat);

// Test 4: What happens when we read from database
console.log('\nTest 4: Database read processing');
const readFromDB = moment(dbFormat).tz('America/New_York');
console.log('Read from DB:', readFromDB.format('YYYY-MM-DD'));
console.log('Read from DB full:', readFromDB.format('YYYY-MM-DD HH:mm:ss'));

// Test 5: Current time in different formats
console.log('\nTest 5: Current time comparison');
const now = moment().tz('America/New_York');
console.log('Current time (NY):', now.format('YYYY-MM-DD HH:mm:ss'));
console.log('Current time (UTC):', now.utc().format('YYYY-MM-DD HH:mm:ss'));

// Test 6: Date only vs datetime
console.log('\nTest 6: Date only vs datetime');
const dateOnly = moment('2024-07-02').tz('America/New_York');
const dateTime = moment('2024-07-02 00:00:00').tz('America/New_York');
console.log('Date only (2024-07-02):', dateOnly.format('YYYY-MM-DD HH:mm:ss'));
console.log('DateTime (2024-07-02 00:00:00):', dateTime.format('YYYY-MM-DD HH:mm:ss'));

// Test 7: What the frontend date input actually sends
console.log('\nTest 7: Frontend date input behavior');
const inputDate = '2024-07-02';
console.log('HTML date input value:', inputDate);
console.log('When sent to backend:', inputDate);

// Test 8: How we should handle it
console.log('\nTest 8: Correct handling');
const correctDate = moment.tz(inputDate, 'America/New_York').startOf('day');
console.log('Correctly parsed:', correctDate.format('YYYY-MM-DD HH:mm:ss'));
console.log('For display:', correctDate.format('YYYY-MM-DD')); 