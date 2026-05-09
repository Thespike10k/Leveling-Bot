// AeroX Leveling System — Made By Joshhhhh
import { SlashCommandBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Command } from '#structures/classes/Command';
import { buildLevelPanel, panelReply } from '../leveling/_panel.js';

export const command = new Command({
  name: 'ping',
  aliases: ['latency'],
  description: 'Check the bot\'s connection latency',
  category: 'General',
  usage: '',
  slashData: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s connection latency'),

  async execute(ctx) {
    const apiPing = Math.round(ctx.client.ws.ping);
    const start = Date.now();

    const ghostButton = new ButtonBuilder()
      .setCustomId('_ping_noop')
      .setLabel('AeroX')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const panel = buildLevelPanel({
      title: 'Bot Latency',
      subtitle: 'Connection Speed',
      sections: [
        {
          accessory: ghostButton,
          lines: [
            '```\n' + 
            `- Web Socket  :: ${apiPing}ms\n` +
            `- Roundtrip   :: Calculating...\n` +
            '```'
          ]
        }
      ]
    });

    const sent = await ctx.reply(panelReply(panel));
    const roundtrip = Date.now() - start;

    const finalPanel = buildLevelPanel({
      title: 'Bot Latency',
      subtitle: 'Connection Speed',
      sections: [
        {
          accessory: ghostButton,
          lines: [
            '```\n' +
            `- Web Socket  :: ${apiPing}ms\n` +
            `- Roundtrip   :: ${roundtrip}ms\n` +
            '```'
          ]
        }
      ]
    });

    if (ctx.isSlash) {
      await ctx.interaction.editReply({ components: [finalPanel] });
    } else {
      await sent.edit({ components: [finalPanel] });
    }
  },
});