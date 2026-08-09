// src/utils/applicationStore.js

/**
 * Almacenamiento temporal para aplicaciones de staff
 * Las respuestas se guardan mientras el usuario completa los 4 modales
 * Se eliminan automáticamente al finalizar la aplicación
 */
export const tempAnswers = new Map();

/**
 * Limpiar las respuestas de un usuario
 */
export function clearApplication(userId) {
  tempAnswers.delete(userId);
}

/**
 * Obtener todas las respuestas de un usuario
 */
export function getApplication(userId) {
  return tempAnswers.get(userId) || {};
}

/**
 * Guardar respuestas de un usuario
 */
export function saveApplication(userId, answers) {
  const current = tempAnswers.get(userId) || {};
  tempAnswers.set(userId, { ...current, ...answers });
  return tempAnswers.get(userId);
}