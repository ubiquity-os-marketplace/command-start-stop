export function checkTaskStale(staleTask: number, createdAt: string) {
  if (staleTask !== 0) {
    const days = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const staleToDays = Math.floor(staleTask / (1000 * 60 * 60 * 24));
    return days >= staleToDays && staleToDays > 0;
  }

  return false;
}
