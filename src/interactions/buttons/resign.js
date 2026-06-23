import { resignAcceptHandler, resignDeclineHandler } from '../../handlers/resignButtons.js';

export default [
  {
    name: 'resign_accept',
    execute: resignAcceptHandler.execute,
  },
  {
    name: 'resign_decline',
    execute: resignDeclineHandler.execute,
  },
];
