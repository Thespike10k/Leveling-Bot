import { logger } from '#utils/logger';

const log = logger.tag('MemberLeave');

export const event = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    if (member.user?.bot) return;
    log.debug(`${member.user?.tag} left ${member.guild.name} — data retained`);
  },
};
