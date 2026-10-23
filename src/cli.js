#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv, loadConfig, evaluateTickets, toCsv, buildSummary, OUTPUT_COLUMNS } from "./sla.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[++i];
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.config || !args.out) {
    console.error("Usage: sla-recalc --input tickets.csv --config config.json --out tickets-out.csv [--report report.md]");
    process.exit(1);
  }
  const config = loadConfig(args.config);
  const tickets = parseCsv(readFileSync(args.input, "utf8"));
  const evaluated = evaluateTickets(tickets, config);
  writeFileSync(args.out, toCsv(evaluated, OUTPUT_COLUMNS));
  const summary = buildSummary(evaluated);
  if (args.report) writeFileSync(args.report, summary); else process.stdout.write(summary);
  console.log("Processed " + evaluated.length + " ticket(s). Wrote " + args.out + (args.report ? " and " + args.report : "") + ".");
}
main();
