import { Command } from 'commander';
import chalk from 'chalk';
import { createPersonaRegistry, getAllPersonas } from '../../../personas/registry.js';

const DEFAULT_DATA_DIR = './data';

export const personasCommand = new Command('personas')
  .alias('p')
  .description('View and manage board member personas')
  .action(async () => {
    try {
      const dataDir = process.env.DATA_DIR || DEFAULT_DATA_DIR;
      const registry = createPersonaRegistry(dataDir);
      const personas = getAllPersonas(registry);

      console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('              BOARD MEMBERS'));
      console.log(chalk.cyan.bold('═══════════════════════════════════════════════\n'));

      for (const persona of personas) {
        const isActive = registry.active.includes(persona.id);
        const status = isActive ? chalk.green('●') : chalk.gray('○');

        console.log(`${status} ${chalk.bold(persona.name)} - ${chalk.italic(persona.title)}`);
        console.log(chalk.gray(`   ${persona.archetype}`));
        console.log(chalk.gray(`   Risk: ${persona.traits.riskTolerance} | Style: ${persona.traits.investmentStyle}`));
        console.log(chalk.yellow(`   "${persona.traits.catchphrases[0]}"`));
        console.log();
      }

      console.log(chalk.gray('─────────────────────────────────────────────────'));
      console.log(chalk.gray(`${personas.length} members (${registry.builtIn.length} built-in, ${registry.custom.length} custom)`));
      console.log(chalk.gray(`${registry.active.length} currently active`));
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });
