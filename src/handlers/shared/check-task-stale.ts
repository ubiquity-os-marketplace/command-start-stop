export function checkTaskStale(staleTaskMilliseconds: number, createdAt: string): boolean {
  if (staleTaskMilliseconds === 0) {
    return false;
  }

  const currentDate = new Date();
  const createdDate = new Date(createdAt);
  const millisecondsSinceCreation = currentDate.getTime() - createdDate.getTime();

  return millisecondsSinceCreation >= staleTaskMilliseconds;
}
