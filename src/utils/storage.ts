export async function loadData() {
  const response = await fetch('https://api.github.com/repos/silvervat/Gantt-Planner/contents/src/data/data.json?ref=main');
  const data = await response.json();
  return JSON.parse(atob(data.content));
}

export async function saveData(data: any) {
  const token = process.env.REACT_APP_GITHUB_TOKEN;
  if (!token) throw new Error('GitHub token puudu');
  const current = await loadData();
  await fetch('https://api.github.com/repos/silvervat/Gantt-Planner/contents/src/data/data.json', {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Update planner data',
      content: btoa(JSON.stringify(data, null, 2)),
      sha: current.sha,
    }),
  });
}
