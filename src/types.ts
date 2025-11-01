export interface Resource {
  id: string;
  name: string;
  color: string;
  department?: string;
  skills?: string[];
  availability?: number; // 0-100%
}

export interface Project {
  id: string;
  name: string;
  color: string;
  status?: 'active' | 'on-hold' | 'completed';
  priority?: 'low' | 'medium' | 'high';
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  from: string; // assignment ID
  to: string;   // assignment ID
  type: DependencyType;
  lag?: number; // days (can be negative for lead time)
}

export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'on-hold';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Assignment {
  id: string;
  projectId: string;
  resourceId: string;
  start: string;
  end: string;
  note?: string;

  // FAAS 1 - Core Features
  progress?: number;        // 0-100
  milestone?: boolean;      // true for milestones
  parent?: string;          // parent assignment ID for hierarchy
  dependencies?: Dependency[]; // task dependencies

  // Additional properties
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  description?: string;

  // Future features
  baseline?: {
    start: string;
    end: string;
  };
  actualStart?: string;
  actualEnd?: string;
}
