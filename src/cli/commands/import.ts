import { Command } from 'commander';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { importLegacyData } from '../../io/legacy-import';
import { graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerImportCommands(program: Command) {
  program
    .command('import')
    .argument('<dir>', 'Legacy data directory path')
    .description('Import legacy XML data')
    .action((dir: string) => {
      const opts = program.opts();
      const files = new Map<string, string>();

      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith('.mpsi') || entry.endsWith('.graphml') || entry.endsWith('.xsql')) {
          files.set(entry, readFileSync(join(dir, entry), 'utf-8'));
        }
      }

      if (files.size === 0) {
        console.error(`No .mpsi or .graphml files found in ${dir}`);
        process.exit(1);
      }

      const data = importLegacyData(files);
      writeFileSync(opts.file, graphToJson(data));

      console.log(
        formatOutput(
          {
            status: 'ok',
            nodesImported: data.nodes.length,
            edgesImported: data.edges.length,
            categoriesImported: data.categories.length,
            referencesImported: data.references.length,
            outputFile: opts.file,
          },
          opts.format as OutputFormat,
        ),
      );
    });
}
