import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { jsonToGraph } from '../../io/json-io';
import { graphToDot } from '../../io/export';
import { formatOutput, type OutputFormat } from '../format';

export function registerExportCommands(program: Command) {
  const exp = program.command('export').description('Export graph data');

  exp
    .command('dot')
    .description('Output Graphviz DOT format')
    .action(() => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      console.log(graphToDot(data));
    });

  exp
    .command('png')
    .option('--output <file>', 'Output PNG file', 'graph.png')
    .description('Render graph as PNG (requires Graphviz dot command)')
    .action(async (cmdOpts: { output: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const dot = graphToDot(data);

      // Try to use Graphviz dot command
      try {
        const { execSync } = await import('child_process');
        execSync(`echo '${dot.replace(/'/g, "\\'")}' | dot -Tpng -o ${cmdOpts.output}`);
        console.log(formatOutput({ status: 'ok', file: cmdOpts.output }, opts.format as OutputFormat));
      } catch {
        // Fallback: write DOT file instead
        const dotFile = cmdOpts.output.replace('.png', '.dot');
        writeFileSync(dotFile, dot);
        console.error(`Graphviz 'dot' command not found. DOT file written to ${dotFile}`);
        console.error('Install Graphviz and run: dot -Tpng ' + dotFile + ' -o ' + cmdOpts.output);
        process.exit(1);
      }
    });
}
