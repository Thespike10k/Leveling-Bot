// AeroX Leveling System — Made By Joshhhhh
import { SlashCommandBuilder } from 'discord.js';
import { Command } from '#structures/classes/Command';
import { buildLevelPanel, panelReply } from '../leveling/_panel.js';
import os from 'os';
import fs from 'fs';

export const command = new Command({
  name: 'stats',
  aliases: ['botstats', 'status'],
  description: 'Show the bot\'s current statistics and system performance',
  category: 'General',
  usage: '',
  slashData: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show the bot\'s current statistics and system performance'),

  async execute(ctx) {
    const client = ctx.client;
    
    // Bot Stats
    const servers = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    const commandsCount = client.commands.size;
    
    // Uptime
    const uptimeSec = process.uptime();
    const d = Math.floor(uptimeSec / 86400);
    const h = Math.floor((uptimeSec % 86400) / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const uptimeStr = `${d}d ${h}h ${m}m`;

    // System Stats
    const shards = client.shard?.count ?? 1;
    const memory = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    
    // CPU Usage (Simple average over all cores)
    const cpus = os.cpus();
    const cpuUsage = cpus.map(cpu => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b);
      return 100 - (100 * cpu.times.idle / total);
    });
    const avgCpu = (cpuUsage.reduce((a, b) => a + b) / cpuUsage.length).toFixed(1);

    // Disk Free (Windows specific drive letter if needed, fallback to /)
    let diskFree = 'N/A';
    try {
      // Use C:\\ for Windows as primary, fallback to / for Linux
      const drive = process.platform === 'win32' ? 'C:\\' : '/';
      const stats = fs.statfsSync(drive);
      diskFree = (Number(stats.bavail) * Number(stats.bsize) / (1024 ** 3)).toFixed(1);
    } catch (err) {
      console.error('Error fetching disk stats:', err);
    }

    // Format the stats block - Plain monospaced alignment
    const statsBlock = [
      `- Servers     :: ${servers}`,
      `- Users       :: ${users}`,
      `- Commands    :: ${commandsCount}`,
      `- Uptime      :: ${uptimeStr}`,
      `- Shards      :: ${shards}`,
      `- Memory      :: ${memory} MB`,
      `- CPU         :: ${avgCpu}%`,
      `- Disk Free   :: ${diskFree} GB`,
    ].join('\n');

    const panel = buildLevelPanel({
      title: 'Bot Statistics',
      subtitle: 'System Performance & Usage',
      sections: [
        {
          lines: [
            '```\n' +
            statsBlock + 
            '\n```'
          ]
        }
      ]
    });

    await ctx.reply(panelReply(panel));
  },
});
