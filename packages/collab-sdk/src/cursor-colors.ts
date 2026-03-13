const CURSOR_COLORS = [
  '#E57373', // red
  '#64B5F6', // blue
  '#81C784', // green
  '#FFB74D', // orange
  '#BA68C8', // purple
  '#4DD0E1', // cyan
  '#F06292', // pink
  '#AED581', // lime
  '#FFD54F', // amber
  '#7986CB', // indigo
  '#4DB6AC', // teal
  '#FF8A65', // deep orange
] as const;

export function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

export { CURSOR_COLORS };
