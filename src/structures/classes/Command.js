export class Command {
  constructor(options) {
    this.name = options.name;
    this.aliases = options.aliases ?? [];
    this.description = options.description ?? 'No description provided.';
    this.usage = options.usage ?? '';
    this.category = options.category ?? 'General';
    this.cooldown = options.cooldown ?? 3;
    this.ownerOnly = options.ownerOnly ?? false;
    this.guildOnly = options.guildOnly ?? true;
    this.slashData = options.slashData ?? null;
    this.execute = options.execute;
    this.autocomplete = options.autocomplete ?? null;
  }
}
