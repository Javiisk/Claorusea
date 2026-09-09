const { Events } = require('discord.js');
const { handleDirectMessage } = require('../utils/dmLogger');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    await handleDirectMessage(message);
  },
};
