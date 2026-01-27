#!/usr/bin/env node
import { createCLI } from './interfaces/cli/index.js';

const program = createCLI();
program.parse();
