import { confessionForgiveHandler, confessionPunishHandler } from '../../handlers/confessionButtons.js';

export default [
  {
    name: 'confession_forgive',
    execute: confessionForgiveHandler.execute,
  },
  {
    name: 'confession_punish',
    execute: confessionPunishHandler.execute,
  },
];
