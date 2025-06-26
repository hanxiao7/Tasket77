# Task Management Tool

A minimal, fast-to-use task management tool designed for handling many small tasks in fast-paced environments. Built with React, TypeScript, Node.js, and SQLite.

## Features

### Core Functionality
- **Clean, compact task list** with status icons, priority flags, and due dates
- **Quick task creation** by typing at the end of the list
- **One-click status cycling**: To Do → In Progress → Paused
- **Double-click to complete** tasks
- **Hover tooltips** for task descriptions
- **Double-click to edit** task details in a modal

### Task Organization
- **Areas/Categories** for organizing tasks by subject or project
- **Sub-tasks support** with automatic parent status updates
- **Priority levels**: Urgent (red), High (yellow), Normal (green), Low (gray)
- **Automatic urgent priority** for tasks due tomorrow

### Views
- **Planner View**: Focus on active tasks, hide completed by default
- **Tracker View**: Work log showing tasks worked on in the last X days
- **Flexible sorting** by status, priority, and last modified date

### Data Management
- **Automatic date tracking**: start, pause, resume, completion dates
- **Task history** for all status changes
- **SQLite database** for reliable data storage
- **Export functionality** for reporting and backups

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

### Setup

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

## Usage

### Quick Start
1. Open http://localhost:3000 in your browser
2. Type a task name in the input field and press Enter
3. Click the status button to start working on the task
4. Double-click the status button to mark as complete

### Task Management
- **Create**: Type in the input field and press Enter
- **Edit**: Double-click any task to open the edit modal
- **Status Change**: Click status button to cycle through states
- **Complete**: Double-click status button to mark as done
- **View Details**: Hover over tasks to see descriptions

### Views
- **Planner**: Focus on active work, tasks sorted by status and priority
- **Tracker**: Review recent work, shows tasks modified in last X days

### Areas/Categories
- Tasks are automatically grouped by area
- Click area headers to expand/collapse
- Create new areas through the API (future enhancement)

## API Endpoints

### Tasks
- `GET /api/tasks` - Get tasks with optional filters
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/history` - Get task history

### Areas
- `GET /api/areas` - Get all areas
- `POST /api/areas` - Create new area

### Export
- `GET /api/export` - Export all tasks as JSON

## Database Schema

### Tables
- **areas**: Task categories/subjects
- **tasks**: Main task data with status, priority, dates
- **task_history**: Complete audit trail of status changes

### Key Features
- Foreign key relationships for data integrity
- Automatic timestamp management
- Status validation constraints
- Priority validation constraints

## Future Enhancements

### Planned Features
- **Long-press status menu** for manual status selection
- **Sub-task confirmation dialog** when all sub-tasks are complete
- **Advanced filtering** with AND/OR/NOT combinations
- **Desktop application** using Electron
- **Team collaboration** features
- **Time tracking** integration
- **Calendar integration**

### Technical Improvements
- **Real-time updates** with WebSocket
- **Offline support** with service workers
- **Data synchronization** across devices
- **Advanced reporting** and analytics
- **API rate limiting** and authentication

## Development

### Project Structure
```
ToDoList/
├── server/           # Backend Node.js/Express server
│   ├── index.js     # Main server file
│   ├── database.js  # Database setup and helpers
│   └── package.json
├── client/          # Frontend React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API service layer
│   │   ├── types/       # TypeScript type definitions
│   │   └── App.tsx      # Main application component
│   └── package.json
└── package.json     # Root package.json for scripts
```

### Technologies Used
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React icons
- **Backend**: Node.js, Express, SQLite3, Moment.js
- **Development**: Concurrently for running both servers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details. 