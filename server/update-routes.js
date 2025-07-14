const fs = require('fs');
const path = require('path');

// Read the current index.js file
const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Routes that need authentication middleware added
const routesToUpdate = [
  // Task routes
  { pattern: /app\.patch\('\/api\/tasks\/:id\/status', async \(req, res\) => \{/g, replacement: "app.patch('/api/tasks/:id/status', authenticateToken, async (req, res) => {" },
  { pattern: /app\.put\('\/api\/tasks\/:id', async \(req, res\) => \{/g, replacement: "app.put('/api/tasks/:id', authenticateToken, async (req, res) => {" },
  { pattern: /app\.delete\('\/api\/tasks\/:id', async \(req, res\) => \{/g, replacement: "app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {" },
  { pattern: /app\.get\('\/api\/tasks\/:id\/history', async \(req, res\) => \{/g, replacement: "app.get('/api/tasks/:id/history', authenticateToken, async (req, res) => {" },
  { pattern: /app\.get\('\/api\/tasks\/:id', async \(req, res\) => \{/g, replacement: "app.get('/api/tasks/:id', authenticateToken, async (req, res) => {" },
  
  // Workspace routes
  { pattern: /app\.get\('\/api\/workspaces', \(req, res\) => \{/g, replacement: "app.get('/api/workspaces', authenticateToken, (req, res) => {" },
  { pattern: /app\.post\('\/api\/workspaces', \(req, res\) => \{/g, replacement: "app.post('/api/workspaces', authenticateToken, (req, res) => {" },
  { pattern: /app\.put\('\/api\/workspaces\/:id', \(req, res\) => \{/g, replacement: "app.put('/api/workspaces/:id', authenticateToken, (req, res) => {" },
  { pattern: /app\.delete\('\/api\/workspaces\/:id', async \(req, res\) => \{/g, replacement: "app.delete('/api/workspaces/:id', authenticateToken, async (req, res) => {" },
  { pattern: /app\.patch\('\/api\/workspaces\/:id\/set-default', \(req, res\) => \{/g, replacement: "app.patch('/api/workspaces/:id/set-default', authenticateToken, (req, res) => {" },
  
  // Export/Import routes
  { pattern: /app\.get\('\/api\/export', async \(req, res\) => \{/g, replacement: "app.get('/api/export', authenticateToken, async (req, res) => {" },
  { pattern: /app\.post\('\/api\/import', async \(req, res\) => \{/g, replacement: "app.post('/api/import', authenticateToken, async (req, res) => {" },
  
  // Backup routes
  { pattern: /app\.get\('\/api\/backup\/stats', async \(req, res\) => \{/g, replacement: "app.get('/api/backup/stats', authenticateToken, async (req, res) => {" },
  { pattern: /app\.post\('\/api\/backup\/create', async \(req, res\) => \{/g, replacement: "app.post('/api/backup/create', authenticateToken, async (req, res) => {" },
  { pattern: /app\.get\('\/api\/backup\/list', async \(req, res\) => \{/g, replacement: "app.get('/api/backup/list', authenticateToken, async (req, res) => {" },
  { pattern: /app\.post\('\/api\/backup\/restore\/:prefix', async \(req, res\) => \{/g, replacement: "app.post('/api/backup/restore/:prefix', authenticateToken, async (req, res) => {" }
];

// Apply all route updates
routesToUpdate.forEach(update => {
  content = content.replace(update.pattern, update.replacement);
});

// Write the updated content back
fs.writeFileSync(indexPath, content, 'utf8');

console.log('Routes updated successfully!'); 