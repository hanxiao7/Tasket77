import React from 'react';
import { Task } from '../types';

interface TaskSummaryProps {
  tasks: Task[];
}

const TaskSummary: React.FC<TaskSummaryProps> = ({ tasks }) => {
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return (
      <div className="mb-1 pl-4 pt-2">
        <span className="text-sm text-gray-600">No tasks found</span>
      </div>
    );
  }

  const statusOrder: Task['status'][] = ['todo', 'in_progress', 'paused', 'done'];
  const statusLabels: Record<Task['status'], string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    paused: 'Paused',
    done: 'Done'
  };

  const statusColors: Record<Task['status'], string> = {
    todo: 'text-gray-600',
    in_progress: 'text-blue-600',
    paused: 'text-yellow-600',
    done: 'text-green-600'
  };

  return (
    <div className="mb-1 pl-4 pt-2">
      <div className="flex items-center space-x-3 text-sm text-gray-600">
        <span className="font-medium">
          {totalTasks} task{totalTasks !== 1 ? 's' : ''}:
        </span>
        {statusOrder.map((status, index) => {
          const count = statusCounts[status] || 0;
          if (count === 0) return null;
          
          return (
            <React.Fragment key={status}>
              <span className={`${statusColors[status]} font-medium`}>
                {count} {statusLabels[status]}
              </span>
              {index < statusOrder.length - 1 && statusCounts[statusOrder[index + 1]] > 0 && (
                <span className="text-gray-400">•</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default TaskSummary; 