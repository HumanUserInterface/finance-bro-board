import { Command } from 'commander';
import { input, number, select, confirm } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import { randomUUID } from 'crypto';
import type { PurchaseRequest, Urgency } from '../../../types/purchase.js';
import type { BoardDeliberation, ResearchOutput, ReasoningOutput, CritiqueOutput } from '../../../types/deliberation.js';
import type { Vote } from '../../../types/vote.js';
import { BoardMeeting } from '../../../core/board.js';
import { BoardMember } from '../../../core/member.js';
import { TogetherProvider } from '../../../llm/together-provider.js';
import { getConfig } from '../../../config.js';
import { createPersonaRegistry, getActivePersonas } from '../../../personas/registry.js';
import { SessionStore } from '../../../storage/session-store.js';

export const deliberateCommand = new Command('deliberate')
  .alias('d')
  .description('Submit a purchase for board deliberation')
  .option('-i, --item <item>', 'Item to purchase')
  .option('-p, --price <price>', 'Price amount', parseFloat)
  .option('-c, --category <category>', 'Purchase category')
  .option('-u, --urgency <urgency>', 'Urgency level (low/medium/high)')
  .option('-d, --description <desc>', 'Additional context')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      const config = getConfig();

      const item =
        options.item ??
        (await input({
          message: 'What do you want to buy?',
          validate: (v) => v.length > 0 || 'Please enter an item',
        }));

      const price =
        options.price ??
        (await number({
          message: 'How much does it cost?',
          required: true,
          min: 0,
        }));

      const category =
        options.category ??
        (await select({
          message: 'What category is this?',
          choices: [
            { value: 'tech', name: 'Technology' },
            { value: 'fashion', name: 'Fashion/Clothing' },
            { value: 'food', name: 'Food/Dining' },
            { value: 'entertainment', name: 'Entertainment' },
            { value: 'health', name: 'Health/Fitness' },
            { value: 'travel', name: 'Travel' },
            { value: 'home', name: 'Home/Furniture' },
            { value: 'education', name: 'Education' },
            { value: 'other', name: 'Other' },
          ],
        }));

      const urgency: Urgency =
        options.urgency ??
        (await select({
          message: 'How urgent is this purchase?',
          choices: [
            { value: 'low', name: 'Low - Can wait' },
            { value: 'medium', name: 'Medium - Want it soon' },
            { value: 'high', name: 'High - Need it now' },
          ],
        }));

      const description =
        options.description ??
        (await input({
          message: 'Any additional context? (optional)',
          default: '',
        }));

      // Display summary
      console.log('\n' + chalk.cyan('Purchase Summary:'));
      console.log(`  Item: ${chalk.bold(item)}`);
      console.log(`  Price: ${chalk.green('$' + price)}`);
      console.log(`  Category: ${category}`);
      console.log(`  Urgency: ${urgency}\n`);

      if (!options.yes) {
        const proceed = await confirm({
          message: 'Submit to the Finance Bro Board?',
          default: true,
        });

        if (!proceed) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      const purchase: PurchaseRequest = {
        id: randomUUID(),
        item,
        price: price!,
        currency: '$',
        category,
        urgency,
        description: description || undefined,
        timestamp: new Date(),
      };

      await executeDeliberation(purchase, config);
    } catch (error) {
      if ((error as Error).message?.includes('User force closed')) {
        console.log(chalk.yellow('\nCancelled.'));
        return;
      }
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

async function executeDeliberation(
  purchase: PurchaseRequest,
  config: ReturnType<typeof getConfig>
): Promise<void> {
  console.log('\n' + chalk.cyan.bold('═══════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('         FINANCE BRO BOARD MEETING'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════\n'));

  // Initialize LLM provider
  const llmProvider = new TogetherProvider({
    apiKey: config.TOGETHER_API_KEY,
    model: config.TOGETHER_MODEL,
    defaultTemperature: config.DEFAULT_TEMPERATURE,
    defaultMaxTokens: config.MAX_TOKENS,
  });

  // Load personas
  const registry = createPersonaRegistry(config.DATA_DIR);
  const personas = getActivePersonas(registry);

  console.log(chalk.gray(`Board members: ${personas.map((p) => p.name).join(', ')}\n`));

  // Create board members
  const members = personas.map((persona) => new BoardMember(persona, llmProvider));

  // Create board meeting
  const board = new BoardMeeting({
    members,
    parallelExecution: config.PARALLEL_EXECUTION,
  });

  // Set up event listeners
  const memberStatus = new Map<string, string>();

  board.on('member:start', (id: string, name: string) => {
    memberStatus.set(id, 'deliberating');
    console.log(chalk.blue(`\n┌─ ${chalk.bold(name)} is reviewing the purchase...`));
  });

  board.on('member:research:complete', (_id: string, _research: ResearchOutput) => {
    console.log(chalk.gray('│  ✓ Research complete'));
  });

  board.on('member:reasoning:complete', (_id: string, reasoning: ReasoningOutput) => {
    const emoji = reasoning.initialOpinion === 'approve' ? '👍' : '👎';
    console.log(chalk.gray(`│  ✓ Initial opinion: ${emoji} ${reasoning.initialOpinion}`));
  });

  board.on('member:critique:complete', (_id: string, _critique: CritiqueOutput) => {
    console.log(chalk.gray('│  ✓ Self-critique complete'));
  });

  board.on('member:vote', (_id: string, vote: Vote) => {
    const voteColor = vote.decision === 'approve' ? chalk.green : chalk.red;
    const voteEmoji = vote.decision === 'approve' ? '✅' : '❌';
    console.log(
      chalk.white(`│  ${voteEmoji} Vote: ${voteColor.bold(vote.decision.toUpperCase())} (${vote.confidence}% confident)`)
    );
    // Show reasoning (truncated for live display)
    const shortReasoning = vote.reasoning.length > 100 ? vote.reasoning.slice(0, 100) + '...' : vote.reasoning;
    console.log(chalk.gray(`│  "${shortReasoning}"`));
    console.log(chalk.white(`└`));
  });

  board.on('member:error', (id: string, error: Error) => {
    console.log(chalk.red(`│  ✗ Error: ${error.message}`));
  });

  // Execute deliberation
  const spinner = ora({
    text: 'Board is deliberating...',
    spinner: 'dots',
  }).start();

  try {
    const result = await board.deliberate(purchase);
    spinner.stop();

    // Save to session
    const sessionStore = new SessionStore(config.DATA_DIR);
    sessionStore.getOrCreateSession(personas.map((p) => p.id));
    sessionStore.addDeliberation(result);

    // Display results
    displayResults(result);
  } catch (error) {
    spinner.fail('Deliberation failed');
    throw error;
  }
}

function displayResults(result: BoardDeliberation): void {
  const { votingResult } = result;

  console.log('\n' + chalk.cyan.bold('═══════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('                 FINAL VERDICT'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════\n'));

  // Vote tally
  console.log(`  ${chalk.green('✅ Approve:')} ${votingResult.approveCount}`);
  console.log(`  ${chalk.red('❌ Reject:')}  ${votingResult.rejectCount}`);

  // Final decision
  const decisionColor = votingResult.finalDecision === 'approve' ? chalk.green : chalk.red;
  const decisionText =
    votingResult.finalDecision === 'approve' ? '✅ APPROVED' : '❌ REJECTED';

  console.log('\n' + chalk.bold(`  The board has ${decisionColor.bold(decisionText)} this purchase!`));

  if (votingResult.unanimousDecision) {
    console.log(chalk.yellow('  (Unanimous decision)'));
  }

  // Individual breakdown
  console.log('\n' + chalk.cyan('─────────────────────────────────────────────────'));
  console.log(chalk.cyan.bold('Individual Votes:\n'));

  for (const vote of votingResult.votes) {
    const icon = vote.decision === 'approve' ? chalk.green('++') : chalk.red('--');
    const conf = chalk.gray(`(${vote.confidence}%)`);
    console.log(`  ${icon} ${chalk.bold(vote.memberName)} ${conf}`);
    // Show full reasoning, wrapped at ~70 chars per line
    const words = vote.reasoning.split(' ');
    let line = '     ';
    for (const word of words) {
      if (line.length + word.length > 75) {
        console.log(chalk.gray(line));
        line = '     ' + word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim().length > 0) {
      console.log(chalk.gray(line));
    }
    console.log('');
  }

  // Stats
  console.log('\n' + chalk.gray('─────────────────────────────────────────────────'));
  console.log(chalk.gray(`Processing time: ${(result.totalProcessingTimeMs / 1000).toFixed(1)}s`));
  console.log(chalk.gray(`Purchase: ${result.purchase.item} - ${result.purchase.currency}${result.purchase.price}`));
}
