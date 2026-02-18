import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname } from 'path';
import type { GraphData } from '../../domain/types';
import { isConstraintEdgeType } from '../../domain/constraints';
import { jsonToGraph } from '../../io/json-io';
import { loadGovernanceConfig, saveGovernanceConfig } from '../../agent/governance';
import { readAuditEntries, readTodayAuditEntries, listAuditDates } from '../../agent/audit';
import { runPublishGate } from '../../agent/publish-validation';
import {
  checkDailyConstraintEdgeCap,
  checkDailyHypothesisCap,
  validateHypothesesForGovernance,
} from '../../agent/hypothesis-governance';
import { formatOutput, type OutputFormat } from '../format';

export function registerGovernanceCommands(program: Command) {
  const governance = program.command('governance').description('Governance configuration, validation, and audit');

  // ── config ─────────────────────────────────────────────────
  governance
    .command('config')
    .option('--show', 'Display current governance config')
    .option('--set <pairs...>', 'Set config values as key=value pairs')
    .description('View or update governance configuration')
    .action((cmdOpts: { show?: boolean; set?: string[] }) => {
      const opts = program.opts();
      const config = loadGovernanceConfig(opts.file);

      if (cmdOpts.set && cmdOpts.set.length > 0) {
        for (const pair of cmdOpts.set) {
          const eqIndex = pair.indexOf('=');
          if (eqIndex === -1) {
            console.error(`Invalid key=value pair: ${pair}`);
            process.exit(1);
          }
          const key = pair.slice(0, eqIndex);
          const value = pair.slice(eqIndex + 1);

          if (!(key in config)) {
            console.error(`Unknown config key: ${key}`);
            process.exit(1);
          }

          const rec = config as unknown as Record<string, unknown>;
          const current = rec[key];
          if (typeof current === 'number') {
            rec[key] = Number(value);
          } else if (typeof current === 'boolean') {
            rec[key] = value === 'true';
          } else {
            rec[key] = value;
          }
        }
        saveGovernanceConfig(opts.file, config);
        console.log(formatOutput({ status: 'ok', config }, opts.format as OutputFormat));
      } else {
        // Default to --show behavior
        console.log(formatOutput(config, opts.format as OutputFormat));
      }
    });

  // ── validate ───────────────────────────────────────────────
  governance
    .command('validate')
    .description('Run publish gate validation on all graph nodes and references')
    .action(() => {
      const opts = program.opts();
      const data: GraphData = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const config = loadGovernanceConfig(opts.file);
      const auditDir = dirname(opts.file);
      const todayAudit = readTodayAuditEntries(auditDir);

      const gateResult = runPublishGate(
        {
          nodes: data.nodes.map((n) => ({ name: n.name, description: n.description })),
          references: data.references.map((r) => ({ title: r.title, year: r.year, doi: r.doi, url: r.url })),
        },
        { nodes: data.nodes, references: data.references, auditEntries: todayAudit },
        config,
      );

      const hypoValidation = validateHypothesesForGovernance(data.hypotheses, data.references, config);
      const hypoCap = checkDailyHypothesisCap(data.hypotheses, config.maxDailyNewHypotheses);
      const constraintCap = checkDailyConstraintEdgeCap(data.edges, config.maxDailyConstraintEdges);

      const errors = [...gateResult.errors, ...hypoValidation.errors];
      const warnings = [...gateResult.warnings, ...hypoValidation.warnings];
      if (!hypoCap.withinCap) {
        errors.push(`Daily hypothesis cap exceeded: ${hypoCap.todayCount}/${config.maxDailyNewHypotheses}`);
      }
      if (!constraintCap.withinCap) {
        errors.push(`Daily constraint-edge cap exceeded: ${constraintCap.todayCount}/${config.maxDailyConstraintEdges}`);
      }

      const output = {
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
        errors,
        warnings,
        hypothesisCap: hypoCap,
        constraintEdgeCap: constraintCap,
      };

      console.log(formatOutput(output, opts.format as OutputFormat));

      if (errors.length > 0) {
        process.exit(1);
      }
    });

  // ── audit ──────────────────────────────────────────────────
  governance
    .command('audit')
    .option('--date <date>', 'Show audit entries for a specific date (YYYY-MM-DD)')
    .option('--today', 'Show today\'s audit entries')
    .option('--entity <id>', 'Filter audit entries by entity ID')
    .description('View audit log entries')
    .action((cmdOpts: { date?: string; today?: boolean; entity?: string }) => {
      const opts = program.opts();
      const auditDir = dirname(opts.file);

      if (!cmdOpts.date && !cmdOpts.today && !cmdOpts.entity) {
        // List available audit dates
        const dates = listAuditDates(auditDir);
        console.log(formatOutput({ dates }, opts.format as OutputFormat));
        return;
      }

      let entries;
      if (cmdOpts.today) {
        entries = readTodayAuditEntries(auditDir);
      } else if (cmdOpts.date) {
        entries = readAuditEntries(auditDir, cmdOpts.date);
      } else {
        // --entity without date: read today's entries
        entries = readTodayAuditEntries(auditDir);
      }

      if (cmdOpts.entity) {
        entries = entries.filter((e) => e.entityId === cmdOpts.entity);
      }

      console.log(formatOutput(entries, opts.format as OutputFormat));
    });

  // ── stats ──────────────────────────────────────────────────
  governance
    .command('stats')
    .description('Show today\'s governance statistics')
    .action(() => {
      const opts = program.opts();
      const data: GraphData = jsonToGraph(readFileSync(opts.file, 'utf-8'));
      const config = loadGovernanceConfig(opts.file);
      const today = new Date().toISOString().slice(0, 10);

      const todayNodes = data.nodes.filter(
        (n) => n.provenance?.timestamp?.startsWith(today),
      );
      const todayHypotheses = data.hypotheses.filter((h) => h.createdAt?.startsWith(today));
      const todayConstraintEdges = data.edges.filter(
        (e) => isConstraintEdgeType(e.type) && e.provenance?.timestamp?.startsWith(today),
      );

      const stats = {
        date: today,
        todayNodeCount: todayNodes.length,
        dailyCap: config.maxDailyNewNodes,
        remaining: Math.max(0, config.maxDailyNewNodes - todayNodes.length),
        todayHypothesisCount: todayHypotheses.length,
        hypothesisDailyCap: config.maxDailyNewHypotheses,
        hypothesisRemaining: Math.max(0, config.maxDailyNewHypotheses - todayHypotheses.length),
        todayConstraintEdgeCount: todayConstraintEdges.length,
        constraintEdgeDailyCap: config.maxDailyConstraintEdges,
        constraintEdgeRemaining: Math.max(0, config.maxDailyConstraintEdges - todayConstraintEdges.length),
        totalNodes: data.nodes.length,
        totalEdges: data.edges.length,
        totalReferences: data.references.length,
        totalHypotheses: data.hypotheses.length,
        maxDailyTrustDelta: config.maxDailyTrustDelta,
      };

      console.log(formatOutput(stats, opts.format as OutputFormat));
    });
}
