# Tasket77

Quick to log. Easy to maintain. See what got done.

A minimal, fast-to-use task management tool designed for handling many small tasks in fast-paced environments. Built with React, TypeScript, Node.js, and PostgreSQL.

## Features

### Core Functionality
- **Clean, compact task list** with status icons, priority flags, and due dates
- **Quick task creation** by typing at the end of the list
- **One-click status cycling**: To Do → In Progress → Paused
- **Double-click to complete** tasks
- **Smart tooltip system** for task descriptions and truncated titles
- **Double-click to edit** task details in a modal
- **Drag and drop** task reordering

### Workspace Management
- **Multiple workspaces** for organizing tasks by project, client, or context
- **Default workspace** that loads automatically on app start
- **Workspace selector** in the header to switch between workspaces
- **Set default workspace** by clicking the star icon next to any workspace
- **Create, edit, and delete** workspaces with descriptions
- **Isolated task sets** - each workspace has its own tasks and tags
- **Visual indicators** for default workspace (star icon)

### Enhanced UI/UX
- **Intelligent title tooltips** that show only truncated text, positioned below titles
- **Dynamic tooltip positioning** that adapts to available space
- **Context menus** for quick task actions
- **Inline editing** for titles, dates, priorities, and tags
- **Auto-save functionality** for descriptions and other fields
- **Keyboard shortcuts** (Ctrl+Enter to save, Esc to cancel)
- **Responsive design** with Tailwind CSS

### Task Organization
- **Tag-based categorization** for organizing tasks by subject or project
- **Sub-tasks support** with automatic parent status updates
- **Priority levels**: Urgent (red), High (yellow), Normal (green), Low (gray)
- **Automatic urgent priority** for tasks due tomorrow
- **Date tracking** for due dates, start dates, and completion dates

### Views
- **Planner View**: Focus on active tasks, hide completed by default
- **Tracker View**: Work log showing tasks worked on in the last X days
- **Flexible sorting** by status, priority, and last modified date
- **Collapsible sections** for better organization

### Data Management
- **Automatic date tracking**: start, pause, resume, completion dates
- **Task history** for all status changes
- **Automatic backup system** with change detection
- **Export functionality** for reporting and backups
- **Real-time updates** with optimistic UI updates

## Data Structure

### Task Status Flow
```
To Do → In Progress ↔ Paused → Done
```

### Priority Levels
- **Urgent** (Red): Automatically set for tasks due tomorrow
- **High** (Yellow): Important tasks
- **Normal** (Green): Standard priority (default)
- **Low** (Gray): Low priority tasks

### Date Tracking
- **Start Date**: Recorded when task moves to "In Progress"
- **Pause/Resume Dates**: Tracked in task history
- **Completion Date**: Recorded when task is marked "Done"
- **Last Modified**: Updated on any task change

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Local Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd ToDoList
   npm run install-all
   ```

2. **Start the development servers**:
   ```bash
   npm run dev
   ```

This will start:
- Backend server on http://localhost:3001
- Frontend development server on http://localhost:3000

### Manual Setup (if needed)

1. **Install root dependencies**:
   ```bash
   npm install
   ```

2. **Install server dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**:
   ```bash
   cd client
   npm install
   ```

4. **Start servers**:
   ```bash
   # Terminal 1 - Start backend
   cd server
   npm run dev
   
   # Terminal 2 - Start frontend
   cd client
   npm start
   ```

## Deployment

### Backend Deployment (Render)

1. **Create a new Web Service on Render**:
   - Connect your GitHub repository
   - Set the **Root Directory** to `server`
   - Set the **Build Command** to `npm install`
   - Set the **Start Command** to `npm start`

2. **Environment Variables** (optional):
   - `PORT`: Render will set this automatically
   - `NODE_ENV`: Set to `production`

3. **Deploy**: Render will automatically deploy your backend

### Frontend Deployment (Vercel)

1. **Connect to Vercel**:
   - Import your GitHub repository
   - Set the **Framework Preset** to `Create React App`
   - Set the **Root Directory** to `client`

2. **Environment Variables**:
   - `REACT_APP_API_URL`: Set to your Render backend URL (e.g., `https://your-app.onrender.com/api`)

3. **Deploy**: Vercel will automatically deploy your frontend

### Environment Configuration

For local development, create a `.env.local` file in the `client` directory:
```
REACT_APP_API_URL=http://localhost:3001/api
```

For production, set the environment variable in your Vercel dashboard:
```
REACT_APP_API_URL=https://your-render-app.onrender.com/api
```

## Usage

### Quick Start
1. Open http://localhost:3000 in your browser
2. The app will load with the default workspace (marked with a star)
3. Type a task name in the input field and press Enter
4. Click the status button to start working on the task
5. Double-click the status button to mark as complete

### Workspace Management
- **Switch Workspaces**: Use the workspace selector in the top-right corner
- **Create Workspace**: Click "Create New Workspace" in the workspace dropdown
- **Set Default**: Click the star icon next to any workspace to make it the default
- **Edit Workspace**: Click the edit icon to modify workspace name and description
- **Delete Workspace**: Click the trash icon to remove a workspace (cannot delete default)

### Task Management
- **Create Task**: Type at the bottom of the task list and press Enter
- **Edit Task**: Double-click any task field to edit inline
- **Status Cycling**: Click the status button to cycle through states
- **Complete Task**: Double-click the status button to mark as done
- **Priority**: Click the priority flag to cycle through levels
- **Tags**: Use the tag selector to categorize tasks
- **Due Dates**: Set due dates for time-sensitive tasks

### Views and Filtering
- **Planner View**: Focus on active tasks and planning
- **Tracker View**: Review recent work and progress
- **Show Completed**: Toggle to see/hide completed tasks
- **Time Range**: Adjust the tracker view time period
- **Sort Tasks**: Use the sort button to reorder by priority/status

## API Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Tasks
- `GET /api/tasks` - Get tasks with optional filters
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/history` - Get task history

### Tags
- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create new tag
- `PUT /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag

### Workspaces
- `GET /api/workspaces` - Get all workspaces
- `POST /api/workspaces` - Create new workspace
- `PUT /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace
- `PATCH /api/workspaces/:id/set-default` - Set workspace as default

### Export & Backup
- `GET /api/export` - Export all tasks as JSON
- `GET /api/backup/stats` - Get backup statistics
- `POST /api/backup/create` - Create manual backup
- `GET /api/backup/list` - List all available backups
- `GET /api/backup/download/:filename` - Download specific backup file

## Database Schema

### Tables
- **workspaces**: Workspace management with default workspace support
- **tags**: Task categorization system (workspace-scoped)
- **tasks**: Main task data with status, priority, dates (workspace-scoped)
- **task_history**: Complete audit trail of status changes

### Key Features
- Foreign key relationships for data integrity
- Automatic timestamp management
- Status validation constraints
- Priority validation constraints
- Tag-based organization
- Workspace isolation for tasks and tags
- Default workspace management

## Technical Improvements

### Frontend Enhancements
- **Optimized tooltip system** with dynamic positioning and width calculation
- **Performance optimizations** with React.memo and useCallback
- **Better state management** with proper cleanup and error handling
- **Responsive design** with mobile-friendly interactions
- **Accessibility improvements** with proper ARIA labels and keyboard navigation
- **Workspace management** with default workspace selection and visual indicators

### Backend Improvements
- **Robust error handling** with proper HTTP status codes
- **Data validation** for all input fields
- **Efficient queries** with proper indexing
- **Real-time data consistency** with optimistic updates
- **Automatic backup system** with SHA-256 change detection
- **Backup management API** for manual backups and statistics
- **Workspace API** with CRUD operations and default workspace management

## Future Enhancements

### Planned Features
- **Task moving between workspaces** with automatic tag migration
- **Long-press status menu** for manual status selection
- **Sub-task confirmation dialog** when all sub-tasks are complete
- **Advanced filtering** with AND/OR/NOT combinations
- **Desktop application** using Electron
- **Team collaboration** features
- **Time tracking** integration
- **Calendar integration**
- **Dark mode** support
- **Offline support** with service workers

### Technical Improvements
- **Real-time updates** with WebSocket
- **Data synchronization** across devices
- **Advanced reporting** and analytics
- **API rate limiting** and authentication
- **Unit and integration tests**
- **Performance monitoring** and analytics

## Development

### Project Structure
```
ToDoList/
├── server/           # Backend Node.js/Express server
│   ├── index.js     # Main server file
│   ├── database.js  # Database setup and helpers
│   ├── backup.js    # Automatic backup system
│   ├── backups/     # Backup files directory
│   └── package.json
├── client/          # Frontend React application
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── TaskList.tsx      # Main task list component
│   │   │   ├── WorkspaceSelector.tsx  # Workspace management
│   │   │   ├── TaskEditModal.tsx # Task editing modal
│   │   │   ├── TagEditModal.tsx  # Tag editing modal
│   │   │   └── ...               # Other components
│   │   ├── services/    # API services
│   │   ├── types/       # TypeScript type definitions
│   │   ├── contexts/    # React contexts
│   │   └── pages/       # Page components
│   └── package.json
└── package.json     # Root package.json for scripts
```

### Key Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, PostgreSQL
- **Authentication**: JWT with secure cookies
- **Database**: PostgreSQL with proper indexing
- **Deployment**: Render (backend), Vercel (frontend)

### Development Workflow
1. **Feature Development**: Create feature branches from main
2. **Testing**: Test locally with both frontend and backend
3. **Code Review**: Submit pull requests for review
4. **Deployment**: Automatic deployment on merge to main
5. **Monitoring**: Monitor logs and performance in production

## Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation for common solutions
- Review the API reference for technical details

---

**Tasket77** - Quick to log. Easy to maintain. See what got done.