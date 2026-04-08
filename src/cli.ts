#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// cli.ts — Command-line interface for tripack
// ─────────────────────────────────────────────────────────────────────────────

import { program } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import { bundle } from './bundler.js';

const pkg = {
    name: 'tripack',
    version: '0.1.1',
    description: 'A minimal JavaScript bundler built from scratch',
};

program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version);

program
    .command('build', { isDefault: true })
    .description('Bundle a JavaScript/TypeScript project')
    .requiredOption('-e, --entry <file>', 'Entry point file')
    .requiredOption('-o, --out <file>', 'Output bundle file')
    .option('--tree-shake', 'Enable dead-code elimination', false)
    .option('--verbose', 'Print detailed build output', false)
    .action(async (opts: {
        entry: string;
        out: string;
        treeShake: boolean;
        verbose: boolean;
    }) => {
        printHeader();

        try {
            const result = await bundle({
                entry: path.resolve(opts.entry),
                outFile: path.resolve(opts.out),
                treeShake: opts.treeShake,
                verbose: opts.verbose,
            });

            printSuccess(result, opts);
        } catch (err: unknown) {
            printError(err);
            process.exit(1);
        }
    });

program.parse();

// ─────────────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────────────

function printHeader(): void {
    console.log();
    console.log(chalk.bold.cyan('⚡ tripack') + chalk.dim(' — minimal JS bundler'));
    console.log(chalk.dim('─'.repeat(48)));
}

function printSuccess(
    result: Awaited<ReturnType<typeof bundle>>,
    opts: { entry: string; out: string; treeShake: boolean },
): void {
    console.log();
    console.log(chalk.green('✓') + chalk.bold(' Build successful'));
    console.log();

    const rows: Array<[string, string]> = [
        ['Entry', chalk.cyan(opts.entry)],
        ['Output', chalk.cyan(result.outFile)],
        ['Modules', chalk.yellow(String(result.moduleCount))],
        ['Size', chalk.yellow(formatBytes(result.size))],
        ['Time', chalk.yellow(`${result.elapsed.toFixed(1)} ms`)],
    ];

    if (opts.treeShake && result.treeShakenBytes !== undefined) {
        rows.push(['Tree-shaken', chalk.green(`-${formatBytes(result.treeShakenBytes)}`)]);
    }

    const labelWidth = Math.max(...rows.map(r => r[0].length)) + 2;
    for (const [label, value] of rows) {
        console.log(`  ${chalk.dim(label.padEnd(labelWidth))}${value}`);
    }

    console.log();
}

function printError(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));

    console.log();
    console.error(chalk.red('✗') + chalk.bold(' Build failed'));
    console.error();
    console.error(chalk.red(error.message));
    if (error.stack && process.env.DEBUG) {
        console.error(chalk.dim(error.stack));
    }
    console.error();
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}