export const tempAnswers = new Map();

export function clearApplication(userId) {
  tempAnswers.delete(userId);
}

export function getApplication(userId) {
  return tempAnswers.get(userId) || {};
}

export function saveApplication(userId, answers) {
  const current = tempAnswers.get(userId) || {};
  tempAnswers.set(userId, { ...current, ...answers });
  return tempAnswers.get(userId);
}