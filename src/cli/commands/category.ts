import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { jsonToGraph, graphToJson } from '../../io/json-io';
import { formatOutput, type OutputFormat } from '../format';

export function registerCategoryCommands(program: Command) {
  const category = program.command('category').description('Manage categories');

  category
    .command('list')
    .description('List all categories')
    .action(() => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      console.log(formatOutput(data.categories, opts.format as OutputFormat));
    });

  category
    .command('add')
    .requiredOption('--id <id>', 'Category ID')
    .requiredOption('--name <name>', 'Category name')
    .option('--color <color>', 'Color hex (e.g. #FF00FF)', '#000000')
    .option('--description <desc>', 'Description', '')
    .description('Add a new category')
    .action((cmdOpts: { id: string; name: string; color: string; description: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));

      if (data.categories.find((c) => c.id === cmdOpts.id)) {
        console.error(`Category ${cmdOpts.id} already exists`);
        process.exit(1);
      }

      const newCat = {
        id: cmdOpts.id,
        name: cmdOpts.name,
        color: cmdOpts.color,
        description: cmdOpts.description,
      };
      data.categories.push(newCat);

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(newCat, opts.format as OutputFormat));
    });

  category
    .command('update')
    .argument('<id>', 'Category ID')
    .option('--name <name>', 'New name')
    .option('--color <color>', 'New color hex')
    .option('--description <desc>', 'New description')
    .description('Update a category')
    .action((id: string, cmdOpts: { name?: string; color?: string; description?: string }) => {
      const opts = program.opts();
      const data = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const cat = data.categories.find((c) => c.id === id);
      if (!cat) {
        console.error(`Category ${id} not found`);
        process.exit(1);
      }

      if (cmdOpts.name !== undefined) cat.name = cmdOpts.name;
      if (cmdOpts.color !== undefined) cat.color = cmdOpts.color;
      if (cmdOpts.description !== undefined) cat.description = cmdOpts.description;

      writeFileSync(opts.file, graphToJson(data));
      console.log(formatOutput(cat, opts.format as OutputFormat));
    });
}
