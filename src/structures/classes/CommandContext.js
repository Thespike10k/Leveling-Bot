import {
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';

export class CommandContext {
  constructor({ message, interaction, args, client }) {
    this.message = message ?? null;
    this.interaction = interaction ?? null;
    this.args = args ?? [];
    this.client = client;
    this.isSlash = !!interaction && interaction.isChatInputCommand();
    this.isPrefix = !!message;
    this.isComponent = !!interaction && interaction.isMessageComponent();
    this.isButton = !!interaction && interaction.isButton();
    this.isSelectMenu = !!interaction && interaction.isStringSelectMenu();

    this.author = message?.author ?? interaction?.user;
    this.guild = message?.guild ?? interaction?.guild;
    this.channel = message?.channel ?? interaction?.channel;
    this.member = message?.member ?? interaction?.member;
  }

  get userId() { return this.author.id; }
  get guildId() { return this.guild?.id; }

  async reply(payload) {
    if (this.isComponent && !this.interaction.replied && !this.interaction.deferred) {
      return this.interaction.update(payload);
    }

    if (this.isSlash || this.isComponent) {
      if (this.interaction.replied || this.interaction.deferred) {
        const response = await this.interaction.editReply({ ...payload, withResponse: true });
        return response.resource?.message ?? response;
      }
      const response = await this.interaction.reply({ 
        ...payload, 
        flags: (payload.flags ?? 0) | MessageFlags.IsComponentsV2,
        withResponse: true 
      });
      return response.resource?.message ?? response;
    }
    return this.channel.send(payload);
  }

  async update(payload) {
    if (this.isComponent) {
      return this.interaction.update(payload);
    }
    return this.reply(payload);
  }

  async deferReply(ephemeral = false) {
    if (this.isSlash && !this.interaction.deferred && !this.interaction.replied) {
      return this.interaction.deferReply({ ephemeral, flags: MessageFlags.IsComponentsV2 });
    }
  }

  static buildContainer(...rows) {
    const c = new ContainerBuilder().setAccentColor(0xffffff);
    for (const row of rows) c.addTextDisplayComponents(row);
    return c;
  }

  static buildMessage(container) {
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    };
  }

  static textRow(content) {
    return new TextDisplayBuilder().setContent(content);
  }

  static separator(divider = false) {
    return new SeparatorBuilder().setDivider(divider);
  }
}
