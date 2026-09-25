// src/utils/musicPlayer.js
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from '@discordjs/voice';
import play from 'play-dl';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { getQueue, createQueue, deleteQueue } from './musicQueue.js';

function buildControlRows(queueData) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_pauseresume').setEmoji(queueData.paused ? '▶️' : '⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volumedown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volumeup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_lyrics').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

const LOOP_LABELS = { none: 'None', track: 'Track', queue: 'Queue' };

export function buildNowPlayingContainer(queueData) {
  const track = queueData.tracks[0];

  const container = new ContainerBuilder()
    .setAccentColor(null)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `### 🎶 Now Playing — ${track.title}`,
          `By ${track.artist}`,
          `Requested by <@${track.requestedBy}>`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Autoplay:** ${queueData.autoplay ? 'On' : 'Off'}`,
          `**Loop:** ${LOOP_LABELS[queueData.loop]}`,
          `**Volume:** ${queueData.volume}%`,
        ].join('\n'),
      ),
    );

  const [row1, row2] = buildControlRows(queueData);
  return container.addActionRowComponents(row1).addActionRowComponents(row2);
}

async function playCurrentTrack(guild) {
  const queueData = getQueue(guild.id);
  const track = queueData.tracks[0];

  const stream = await play.stream(track.url);
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
    inlineVolume: true,
  });
  resource.volume.setVolume(queueData.volume / 100);

  queueData.resource = resource;
  queueData.paused = false;
  queueData.player.play(resource);

  const container = buildNowPlayingContainer(queueData);

  // Edit the previous now-playing message instead of spamming a new one,
  // when this is a track change triggered from the queue (not /play).
  if (queueData.nowPlayingMessage) {
    await queueData.nowPlayingMessage.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  } else {
    queueData.nowPlayingMessage = await queueData.textChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

export async function enqueueAndPlay({ guild, voiceChannel, textChannel, track }) {
  let queueData = getQueue(guild.id);

  if (!queueData) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    queueData = createQueue(guild.id, {
      connection,
      player,
      tracks: [],
      loop: 'none',
      autoplay: false,
      volume: 85,
      paused: false,
      textChannel,
      nowPlayingMessage: null,
    });

    player.on(AudioPlayerStatus.Idle, () => {
      const q = getQueue(guild.id);
      if (!q) return;

      const finished = q.tracks[0];

      if (q.loop === 'track') {
        // Keep the same track at the front — just replay it.
      } else {
        q.tracks.shift();
        if (q.loop === 'queue' && finished) {
          q.tracks.push(finished);
        }
      }

      if (q.tracks.length > 0) {
        playCurrentTrack(guild).catch((error) => console.error('❌ Music playback error:', error));
      } else {
        q.connection.destroy();
        deleteQueue(guild.id);
      }
    });

    player.on('error', (error) => {
      console.error('❌ Audio player error:', error);
    });
  }

  queueData.tracks.push(track);

  if (queueData.tracks.length === 1) {
    await playCurrentTrack(guild);
    return { queued: false };
  }

  return { queued: true, position: queueData.tracks.length };
}
