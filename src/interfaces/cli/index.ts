import { Command } from 'commander';
import { deliberateCommand } from './commands/deliberate.js';
import { historyCommand } from './commands/history.js';
import { personasCommand } from './commands/personas.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('finance-bro')
    .description('Finance Bro Board - Your AI financial advisory board')
    .version('1.0.0');

  program.addCommand(deliberateCommand);
  program.addCommand(historyCommand);
  program.addCommand(personasCommand);

  return program;
}
