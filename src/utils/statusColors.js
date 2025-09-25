export const STATUS_COLORS = {
  draft: '#9E9E9E', // Bozza - grey
  pending: '#FB8C00', // In attesa - orange
  in_progress: '#1976D2', // In corso - blue
  completed: '#2E7D32', // Completato - green
  cancelled: '#E53935'
};

export const getStatusColor = (s) => {
  if (!s) return STATUS_COLORS.draft;
  const key = String(s).toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.draft;
};
