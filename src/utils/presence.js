// src/utils/presence.js
import { ActivityType } from 'discord.js';

const ACTIVITY_TYPES = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
  custom: ActivityType.Custom,
};

// Estados base
const BASE_STATES = [
  { text: '「🏕️」Whispering Pines Summer Camp', type: 'playing' },
  { text: '「👁️」Roamers & Questions', type: 'watching' },
  { text: '「🔐」Moderation & Staff', type: 'listening' },
  { text: '「📢」Announcing & Hosting', type: 'watching' },
];

// Estado especial (se agrega a la cola si las apps están abiertas)
const APPS_STATE = { text: '「📜」Reviewing Apps', type: 'watching' };

let currentIndex = 0;
let appsOpen = false;
let presenceInterval = null;

export function applyPresence(client, text, type = 'watching') {
  const activityType = ACTIVITY_TYPES[type.toLowerCase()] ?? ActivityType.Watching;
  client.user.setPresence({
    activities: [{ name: text, type: activityType }],
    status: 'online',
  });
}

// Función que obtiene la lista de estados actual (4 o 5 dependiendo de si appsOpen es true)
function getCurrentStates() {
  return appsOpen ? [...BASE_STATES, APPS_STATE] : BASE_STATES;
}

// Esta función la llama el comando /appstatus
export function setAppsStatus(client, isOpen) {
  appsOpen = isOpen;
  // No forzamos el cambio inmediato, dejamos que la rotación lo agarre en el próximo tick.
  // Pero si quieres que se actualice YA, puedes llamar a rotate() aquí.
}

// Función que rota al siguiente estado
function rotate(client) {
  const states = getCurrentStates();
  currentIndex = (currentIndex + 1) % states.length;
  const state = states[currentIndex];
  applyPresence(client, state.text, state.type);
}

// Iniciar la rotación
export function startPresenceRotation(client) {
  if (presenceInterval) clearInterval(presenceInterval);

  // Iniciar en el primer estado
  const states = getCurrentStates();
  applyPresence(client, states[0].text, states[0].type);
  currentIndex = 0;

  // Rotar cada 2 minutos (120,000 ms)
  presenceInterval = setInterval(() => rotate(client), 2 * 60 * 1000);
  console.log('✅ Presence rotation started (every 2 minutes)');
}