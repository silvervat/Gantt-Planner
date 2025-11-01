import initialData from '../data/data.json';

export async function loadData() {
  // Return data from local file instead of GitHub API
  return Promise.resolve(initialData);
}

export async function saveData(data: any) {
  // For now, just log - we can't save back to the file in production
  // This would need a backend API to work properly
  console.log('Save data (not persisted):', data);
  return Promise.resolve();
}
