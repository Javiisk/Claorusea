// src/utils/musicButtons.js
import { MessageFlags } from 'discord.js';
import { getQueue, deleteQueue } from './musicQueue.js';
import { buildNowPlayingContainer } from './musicPlayer.js';

export async function handleMusicButton(interaction) {
  const queueData = getQueue(interaction.guild.id);

  if (!queueData) {
    return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
  }

  switch (interaction.customId) {
    case 'music_pauseresume': {
      if (queueData.paused) {
        queueData.player.unpause();
        queueData.paused = false;
      } else {
        queueData.player.pause();
        queueData.paused = true;
      }
      break;
    }

    case 'music_skip': {
      queueData.player.stop(); // fires AudioPlayerStatus.Idle -> advances the queue
      return interaction.deferUpdate();
    }

    case 'music_stop': {
      queueData.tracks = [];
      queueData.player.stop();
      queueData.connection.destroy();
      deleteQueue(interaction.guild.id);
      return interaction.deferUpdate();
    }

    case 'music_loop': {
      queueData.loop = queueData.loop === 'none' ? 'track' : queueData.loop === 'track' ? 'queue' : 'none';
      break;
    }

    case 'music_shuffle': {
      // Shuffle everything except the currently playing track (index 0).
      for (let i = queueData.tracks.length - 1; i > 1; i--) {
        const j = 1 + Math.floor(Math.random() * i);
        [queueData.tracks[i], queueData.tracks[j]] = [queueData.tracks[j], queueData.tracks[i]];
      }
      break;
    }

    case 'music_volumeup': {
      queueData.volume = Math.min(100, queueData.volume + 10);
      queueData.resource?.volume?.setVolume(queueData.volume / 100);
      break;
    }

    case 'music_volumedown': {
      queueData.volume = Math.max(0, queueData.volume - 10);
      queueData.resource?.volume?.setVolume(queueData.volume / 100);
      break;
    }

    case 'music_previous':
    case 'music_queue':
    case 'music_lyrics': {
      return interaction.reply({ content: 'ℹ️ This feature isn\'t implemented yet.', ephemeral: true });
    }
  }

  const updatedContainer = buildNowPlayingContainer(queueData);
  await interaction.update({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 });
}
