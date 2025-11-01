export interface Resource {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Assignment {
  id: string;
  projectId: string;
  resourceId: string;
  start: string;
  end: string;
  note?: string;
}
