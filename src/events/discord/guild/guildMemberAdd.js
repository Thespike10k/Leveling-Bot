import { UserService } from '../../../database/services/UserService.js';
import { emoji } from '#utils/emoji';
import { logger } from '#utils/logger';

const log = logger.tag('MemberAdd');

export const event = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    if (member.user.bot) return;
    UserService.ensure(member.id, member.guild.id);
    log.debug(`Ensured profile for ${member.user.tag} in ${member.guild.name}`);
  },
};
