#!/usr/bin/env node
/**
 * @file cli.js
 * @description Ultra-Minimalist AI Research Terminal for NeuroSyn-Math.
 * Features: Background log writing to file, fixed paste buffer, clean UI.
 */

process.noDeprecation = true; // Mute Node deprecation warnings
process.stdout.write('\x1b[?2004h'); // Enable Bracketed Paste Mode

process.on('exit', () => {
    process.stdout.write('\x1b[?2004l');
});

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { performance } from 'perf_hooks';
import { dbService } from './backend/src/config/db.js';

const STORE_DIR = path.join(os.homedir(), '.neurosyn');
const LOG_FILE = path.join(STORE_DIR, 'backend.log');

if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
}

// Clear old log file on startup
fs.writeFileSync(LOG_FILE, '=== NEUROSYN-MATH BACKEND LOGS ===\n', 'utf8');

// --- ROUTE ALL LOGS TO PHYSICAL FILE ---
import logger from './backend/src/utils/logger.js';
function writeToFile(level, msg) {
    const time = new Date().toLocaleTimeString();
    const clean = String(msg).replace(/\[\d{4}-\d{2}-\d{2}T.*?\]/g, '').replace(/\[INFO\]|\[WARN\]|\[ERROR\]/g, '').trim();
    if (clean) {
        fs.appendFileSync(LOG_FILE, `[${time}] [${level.toUpperCase()}] ${clean}\n`, 'utf8');
    }
}

logger.info = (msg) => writeToFile('info', msg);
logger.warn = (msg) => writeToFile('warn', msg);
logger.error = (msg) => {
    writeToFile('error', msg);
    // Errors should still print to the CLI so the user isn't blind
    process.stdout.write(`\n  ${chalk.red('❌ Backend Error:')} ${chalk.red(msg)}\n`);
};
logger.debug = (msg) => writeToFile('debug', msg);

// Load local .env or fallback to ~/.neurosyn/.env
if (fs.existsSync('.env')) {
    process.loadEnvFile('.env');
} else {
    const homeEnv = path.join(os.homedir(), '.neurosyn', '.env');
    if (fs.existsSync(homeEnv)) {
        process.loadEnvFile(homeEnv);
    }
}

const writeLine = (str = '') => process.stdout.write(`${str}\n`);

/* ============================================================================
 * 1. THEMES
 * ==========================================================================*/
const THEMES = {
    tokyo: { name: 'Tokyo Night', primary: '#7AA2F7', accent: '#BB9AF7', success: '#9ECE6A', warning: '#E0AF68', error: '#F7768E', info: '#7DCFFF', muted: '#565F89', text: '#C0CAF5', border: '#292E42', prompt: '#7AA2F7', coral: '#D97757' },
    nord: { name: 'Nord', primary: '#88C0D0', accent: '#B48EAD', success: '#A3BE8C', warning: '#EBCB8B', error: '#BF616A', info: '#81A1C1', muted: '#4C566A', text: '#ECEFF4', border: '#4C566A', prompt: '#88C0D0', coral: '#D97757' },
    catppuccin: { name: 'Catppuccin', primary: '#89B4FA', accent: '#CBA6F7', success: '#A6E3A1', warning: '#F9E2AF', error: '#F38BA8', info: '#89DCEB', muted: '#6C7086', text: '#CDD6F4', border: '#45475A', prompt: '#89B4FA', coral: '#D97757' }
};

let currentThemeKey = 'tokyo';

function getTheme() {
    const t = THEMES[currentThemeKey] || THEMES.tokyo;
    return {
        primary: chalk.hex(t.primary), accent: chalk.hex(t.accent), success: chalk.hex(t.success),
        warning: chalk.hex(t.warning), error: chalk.hex(t.error), info: chalk.hex(t.info),
        muted: chalk.hex(t.muted), text: chalk.hex(t.text), coral: chalk.hex(t.coral),
        bold: chalk.bold, borderColor: t.border, promptColor: chalk.hex(t.prompt)
    };
}

/* ============================================================================
 * 2. CLAUDE CODE BANNER & AUTHENTICATION
 * ==========================================================================*/
function printClaudeStyleBanner() {
    const th = getTheme();
    const blockBanner = `
███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗ ███████╗██╗   ██╗███╗   ██╗
████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝╚██╗ ██╔╝████╗  ██║
██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║███████╗ ╚████╔╝ ██╔██╗ ██║
██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║╚════██║  ╚██╔╝  ██║╚██╗██║
██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝███████║   ██║   ██║ ╚████║
╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═══╝

███╗   ███╗ ████xA1╗████████╗██╗  ██╗
████╗ ████║██╔══██╗╚══██╔══╝██║  ██║
██╔████╔██║███████║   ██║   ███████║
██║╚██╔╝██║██╔══██║   ██║   ██╔══██║
██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║
╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚══╝
`;
    writeLine(th.coral.bold(blockBanner));
}

function promptQuestion(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

let activeUser = null;

async function authenticateUser() {
    console.clear();
    const th = getTheme();
    printClaudeStyleBanner();

    writeLine(`  ${th.primary.bold('────────────────────────────────────────────────────────────────────────────')}`);
    writeLine(`  ${th.primary.bold('   🔐 NEUROSYN-MATH LOCAL AUTHENTICATION')}`);
    writeLine(`  ${th.primary.bold('────────────────────────────────────────────────────────────────────────────')}\n`);

    await dbService.connect();

    if (!dbService.isConnected) {
        writeLine(`  ${th.warning('⚠️ MongoDB not detected. Proceeding in Guest Mode.')}\n`);
        activeUser = { username: 'Guest' };
        return;
    }

    while (!activeUser) {
        writeLine(`  ${th.info('1.')} Login Existing User`);
        writeLine(`  ${th.info('2.')} Register New User`);
        writeLine(`  ${th.info('3.')} Continue as Guest\n`);

        const choice = (await promptQuestion(`  ${th.promptColor('Choice (1-3): ')}`)).trim();

        if (choice === '1') {
            const u = (await promptQuestion(`  ${th.promptColor('Username: ')}`)).trim();
            const p = (await promptQuestion(`  ${th.promptColor('Password: ')}`)).trim();
            try { activeUser = await dbService.loginUser(u, p); writeLine(`\n  ${th.success(`✔ Welcome back, ${activeUser.username}!`)}\n`); }
            catch (e) { writeLine(`\n  ${th.error('❌ ' + e.message)}\n`); }
        } else if (choice === '2') {
            const u = (await promptQuestion(`  ${th.promptColor('New Username: ')}`)).trim();
            if (await dbService.checkUsernameExists(u)) { writeLine(`\n  ${th.warning('⚠️ Username taken.')}\n`); continue; }
            const p = (await promptQuestion(`  ${th.promptColor('New Password: ')}`)).trim();
            try { activeUser = await dbService.registerUser(u, p); writeLine(`\n  ${th.success(`✔ Welcome, ${activeUser.username}!`)}\n`); }
            catch (e) { writeLine(`\n  ${th.error('❌ ' + e.message)}\n`); }
        } else {
            activeUser = { username: 'Guest' };
            writeLine(`\n  ${th.warning('Proceeding in Guest Mode.')}\n`);
        }
    }
}

/* ============================================================================
 * 3. BACKEND LOAD (Package-relative path fix for npx)
 * ==========================================================================*/
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REAL_BACKEND_PATH = path.join(__dirname, 'backend/src/services/synapseFabric.js');

let backend;
if (fs.existsSync(REAL_BACKEND_PATH)) {
    const mod = await import(REAL_BACKEND_PATH);
    backend = mod.default;
} else {
    writeLine(chalk.red(`❌ Backend fabric missing at ${REAL_BACKEND_PATH}\n`));
    process.exit(1);
}

/* ============================================================================
 * 4. MINIMALIST RENDERERS
 * ==========================================================================*/
function printMinimalHeader() {
    console.clear();
    const th = getTheme();
    const model = process.env.LOCAL_MATH_MODEL || process.env.OPENAI_MODEL || 'deepseek-r1:32b';
    writeLine();
    writeLine(`  ${th.primary.bold('NeuroSyn Math Engine')}  ${th.muted('·')}  ${th.accent(model)}  ${th.muted('·')}  User: ${th.success(activeUser?.username || 'Guest')}`);
    writeLine(`  ${th.muted('────────────────────────────────────────────────────────────────────────────')}`);
    writeLine(`  ${th.info.bold('Backend logs writing to:')} ${th.muted(LOG_FILE)}`);
    writeLine(`  ${th.muted('To watch live, open a new tab and run:')} ${th.accent('tail -f ' + LOG_FILE)}`);
    writeLine(`  ${th.muted('────────────────────────────────────────────────────────────────────────────')}`);
    writeLine();
}

function renderResultCard(problemText, result, elapsed) {
    const th = getTheme();
    const confidencePct = ((result.confidence || 0) * 100).toFixed(1);
    const verified = result.verifiedInLean;
    const separator = th.muted('  ────────────────────────────────────────────────────────────────────────────');

    writeLine();
    writeLine(separator);
    writeLine(`  ${th.primary.bold('◆ PROBLEM')}`);
    writeLine(`  ${th.text(problemText)}`);
    writeLine(separator);

    writeLine(`  ${th.primary.bold('◆ MATHEMATICAL SOLUTION')}`);
    const solText = result.explanation?.undergraduate || result.finalResponse || 'Proof complete.';

    // ⚡ Rich Formatting for Markdown elements inside CLI
    solText.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
            writeLine(`  ${th.accent.bold(line)}`);
        } else if (trimmed.startsWith('```')) {
            writeLine(`  ${th.muted(line)}`);
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            writeLine(`  ${th.info('•')} ${th.text(line.replace(/^[-*]\s*/, ''))}`);
        } else {
            writeLine(`  ${th.text(line)}`);
        }
    });
    writeLine();

    if (result.formalProof) {
        writeLine(separator);
        writeLine(`  ${th.accent.bold('◆ LEAN 4 FORMAL THEOREM')}`);
        writeLine(`  ${th.muted('```lean')}`);
        result.formalProof.trim().split('\n').forEach(line => writeLine(`  ${th.info(line)}`));
        writeLine(`  ${th.muted('```')}`);
        writeLine();
    }

    writeLine(separator);
    writeLine(`  ${th.muted('Domain:')} ${th.text(result.primaryDomain || 'Algebra')}   ${th.muted('│')}   ${th.muted('Confidence:')} ${th.success(confidencePct + '%')}   ${th.muted('│')}   ${th.muted('Lean 4:')} ${verified ? th.success('VERIFIED ✅') : th.warning('SYMBOLICALLY CHECKED ⚠️')}   ${th.muted('│')}   ${th.muted('Time:')} ${th.text(elapsed + 's')}`);
    writeLine(separator);
    writeLine();
}

/* ============================================================================
 * 5. COMMAND HANDLER
 * ==========================================================================*/
async function handleCommand(cmdString) {
    const th = getTheme();
    const cleanInput = cmdString.trim().replace(/\/+$/, '');
    const parts = cleanInput.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts[1] || '';

    switch (cmd) {
        case '/help':
            writeLine(`\n  ${th.primary.bold('NeuroSyn-Math Commands:')}`);
            writeLine(`  ${th.info('/history')}       ${th.muted('List user history')}`);
            writeLine(`  ${th.info('/history [n]')}   ${th.muted('Inspect past proof #n')}`);
            writeLine(`  ${th.info('/theme')}         ${th.muted('Change theme (/theme tokyo|nord|catppuccin)')}`);
            writeLine(`  ${th.info('/logout')}        ${th.muted('Log out of current user account')}`);
            writeLine(`  ${th.info('/clear')}         ${th.muted('Clear screen')}`);
            writeLine(`  ${th.info('/exit')}          ${th.muted('Exit application')}\n`);
            break;

        case '/logout':
            activeUser = null;
            await authenticateUser();
            printMinimalHeader();
            break;

        case '/theme':
            if (THEMES[arg]) {
                currentThemeKey = arg;
                printMinimalHeader();
                writeLine(`  ${th.success(`✔ Theme switched to ${THEMES[arg].name}`)}\n`);
            } else {
                writeLine(`  ${th.error(`Unknown theme '${arg}'. Options: tokyo, nord, catppuccin`)}\n`);
            }
            break;

        case '/clear':
            printMinimalHeader();
            break;

        case '/exit':
        case '/quit':
            writeLine(`\n  ${th.muted('Goodbye!')}\n`);
            process.exit(0);

        case '/history':
            const historyItems = await dbService.getUserHistory(activeUser);
            if (arg && !isNaN(parseInt(arg, 10))) {
                const item = historyItems[parseInt(arg, 10) - 1];
                if (!item) {
                    writeLine(`\n  ${th.error(`History item #${arg} not found.`)}\n`);
                } else {
                    const historicalResult = {
                        primaryDomain: item.primaryDomain, confidence: item.confidence, verifiedInLean: item.verifiedInLean,
                        explanation: { undergraduate: item.explanation }, formalProof: item.formalProof
                    };
                    renderResultCard(item.prompt, historicalResult, item.elapsedSeconds?.toFixed(2) || '0.00');
                }
            } else {
                writeLine(`\n  ${th.primary.bold('User History:')} ${th.muted('(Type /history 1 to view full solution)')}`);
                if (!historyItems.length) {
                    writeLine(`  ${th.muted('No past history found.')}\n`);
                } else {
                    historyItems.forEach((item, idx) => {
                        const statusTag = item.verifiedInLean ? th.success('[VERIFIED]') : th.warning('[SYMBOLIC]');
                        writeLine(`  ${th.primary.bold('[' + (idx + 1) + ']')} ${statusTag} ${th.text(item.prompt.slice(0, 65))}...`);
                    });
                    writeLine();
                }
            }
            break;

        default:
            writeLine(`  ${th.error(`Unknown command '${cmd}'. Type /help for menu.`)}\n`);
    }
}

/* ============================================================================
 * 6. INTERACTIVE REPL LOOP
 * ==========================================================================*/
async function startREPL() {
    await authenticateUser();
    printMinimalHeader();

    process.stdin.resume();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: getTheme().promptColor('NeuroSyn ❯ ')
    });

    rl.on('SIGINT', () => {
        writeLine(`\n\n  ${getTheme().muted('Goodbye!')}\n`);
        process.exit(0);
    });

    let inputBuffer = [];
    let pasteTimeout = null;
    let isProcessing = false;

    rl.prompt();

    rl.on('line', (line) => {
        if (isProcessing) return;

        const cleanLine = line.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
        inputBuffer.push(cleanLine);
        clearTimeout(pasteTimeout);

        rl.setPrompt(''); // Hide prompt during paste

        pasteTimeout = setTimeout(async () => {
            const input = inputBuffer.join('\n').trim();
            inputBuffer = [];
            const th = getTheme();

            rl.setPrompt(th.promptColor('NeuroSyn ❯ '));

            if (!input) { rl.prompt(); return; }
            if (input.startsWith('/')) { await handleCommand(input); rl.prompt(); return; }

            isProcessing = true;
            writeLine();

            const startMs = performance.now();

            const spinner = ora({ text: th.info('Initiating...'), color: 'cyan', indent: 2 }).start();

            let timer = setInterval(() => {
                const elap = ((performance.now() - startMs) / 1000).toFixed(1);
                const currentText = spinner.text.replace(/ \[\d+\.\ds\]$/, '');
                spinner.text = `${currentText} ${th.muted('[' + elap + 's]')}`;
            }, 500);

            let isStreamingTokens = false;

            const streamHandler = (type, data) => {
                if (type === 'status') {
                    if (isStreamingTokens) {
                        writeLine(); // Break line after token stream finishes
                        isStreamingTokens = false;
                        spinner.start(); // Resume spinner
                    }
                    const msg = data.message.replace(/\[.*?\]/, '').trim();
                    const cleanMsg = msg.length > 70 ? msg.slice(0, 67) + '...' : msg;
                    spinner.text = th.info(`⚡ ${cleanMsg}`);
                } else if (type === 'token') {
                    if (!isStreamingTokens) {
                        spinner.stop(); // Pause spinner to avoid graphical glitches
                        process.stdout.write(`\n  ${th.muted('🧠 [Model Thinking]: ')}`);
                        isStreamingTokens = true;
                    }
                    // Print to CLI in real-time
                    process.stdout.write(th.muted(data));
                    
                    // Also stream silently to backend.log for tail -f
                    fs.appendFileSync(LOG_FILE, data, 'utf8');
                }
            };

            try {
                const result = await backend.processPrompt(input, { sendStreamData: streamHandler, userId: activeUser?.username });
                clearInterval(timer);
                const elapsed = ((performance.now() - startMs) / 1000).toFixed(2);

                spinner.succeed(` ${th.success.bold('Reasoning Complete')} ${th.muted('(' + elapsed + 's)')}`);
                await dbService.saveHistory(activeUser, input, result, elapsed);

                renderResultCard(input, result, elapsed);
            } catch (err) {
                clearInterval(timer);
                spinner.fail(` ${th.error.bold('Error:')} ${err.message}`);
                writeLine();
            }

            isProcessing = false;
            rl.prompt();
        }, 150);
    });
}

startREPL();