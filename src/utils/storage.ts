import initialData from '../data/data.json';

const STORAGE_KEY = 'gantt-planner-data';

export async function loadData() {
  try {
    // Try to load from localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('Loaded data from localStorage');
      return Promise.resolve(parsed);
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }

  // Fall back to initial data
  console.log('Using initial data');
  return Promise.resolve(initialData);
}

export async function saveData(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('Data saved to localStorage');
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
  return Promise.resolve();
}
