import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '../../../config.js';
import { SessionStore } from '../../../storage/session-store.js';

export const historyCommand = new Command('history')
  .alias('h')
  .description('View past deliberations and decisions')
  .option('-s, --session <id>', 'View specific session')
  .option('-l, --list', 'List all sessions')
  .action(async (options) => {
    try {
      const config = getConfig();
      const sessionStore = new SessionStore(config.DATA_DIR);

      if (options.list) {
        listSessions(sessionStore);
        return;
      }

      const deliberations = sessionStore.getDeliberationHistory(options.session);

      if (deliberations.length === 0) {
        console.log(chalk.yellow('No deliberations found.'));
        console.log(chalk.gray('Run `finance-bro deliberate` to submit your first purchase!'));
        return;
      }

      console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('           DELIBERATION HISTORY'));
      console.log(chalk.cyan.bold('═══════════════════════════════════════════════\n'));

      for (const deliberation of deliberations.reverse()) {
        const decision = deliberation.votingResult.finalDecision;
        const icon = decision === 'approve' ? chalk.green('✅') : chalk.red('❌');
        const decisionText = decision === 'approve' ? chalk.green('APPROVED') : chalk.red('REJECTED');

        console.log(
          `${icon} ${chalk.bold(deliberation.purchase.item)} - ${deliberation.purchase.currency}${deliberation.purchase.price}`
        );
        console.log(`   ${decisionText} (${deliberation.votingResult.approveCount}-${deliberation.votingResult.rejectCount})`);
        console.log(chalk.gray(`   ${new Date(deliberation.completedAt).toLocaleString()}`));
        console.log();
      }

      // Summary
      const approved = deliberations.filter((d) => d.votingResult.finalDecision === 'approve');
      const rejected = deliberations.filter((d) => d.votingResult.finalDecision === 'reject');
      const totalApproved = approved.reduce((sum, d) => sum + d.purchase.price, 0);

      console.log(chalk.cyan('─────────────────────────────────────────────────'));
      console.log(`Total deliberations: ${deliberations.length}`);
      console.log(`Approved: ${chalk.green(approved.length)} | Rejected: ${chalk.red(rejected.length)}`);
      console.log(`Total approved spending: ${chalk.green('$' + totalApproved.toFixed(2))}`);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

function listSessions(sessionStore: SessionStore): void {
  const sessions = sessionStore.listSessions();

  if (sessions.length === 0) {
    console.log(chalk.yellow('No sessions found.'));
    return;
  }

  console.log(chalk.cyan.bold('\n═══════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('                 SESSIONS'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════\n'));

  for (const session of sessions) {
    console.log(chalk.bold(session.name || `Session ${session.id.slice(0, 8)}`));
    console.log(chalk.gray(`  ID: ${session.id}`));
    console.log(chalk.gray(`  Created: ${session.createdAt.toLocaleString()}`));
    console.log(`  Deliberations: ${session.deliberationCount}`);
    console.log(`  Approved: ${chalk.green(session.totalApproved)} | Rejected: ${chalk.red(session.totalRejected)}`);
    console.log(`  Total approved: ${chalk.green('$' + session.totalSpentApproved.toFixed(2))}`);
    console.log();
  }
}
