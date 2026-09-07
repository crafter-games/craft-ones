#!/usr/bin/env bun
/**
 * Craft Ones milestone convergence gate.
 *
 * Runs the five verification commands from AGENTS.md and reports every
 * milestone acceptance criterion against the test that actually backs it.
 * Evidence is checked by locating the referenced test title in its file, so a
 * renamed or deleted test breaks the map loudly instead of going unnoticed.
 *
 *   bun scripts/converge.ts                  run the whole gate
 *   bun scripts/converge.ts --list           print the evidence map only
 *   bun scripts/converge.ts --only=lint,e2e run a subset
 *   bun scripts/converge.ts --allow-busy-web build even with a dev server up
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Gate = { id: string; command: string[]; purpose: string };
type Evidence = { file: string; title: string };
type Criterion = { id: string; text: string; evidence: Evidence[] };
type Outcome = { gate: Gate; status: "pass" | "fail" | "skip"; note: string };

const GATES: Gate[] = [
  {
    id: "test",
    command: ["bun", "test"],
    purpose: "authoritative server suite",
  },
  {
    id: "typecheck",
    command: ["bun", "run", "typecheck"],
    purpose: "workspaces plus browser tests",
  },
  {
    id: "lint",
    command: ["bun", "run", "lint"],
    purpose: "biome across the repo",
  },
  {
    id: "build",
    command: ["bun", "run", "build"],
    purpose: "Next production build",
  },
  {
    id: "e2e",
    command: ["bun", "run", "test:e2e"],
    purpose: "Playwright browser suite",
  },
];

const CRITERIA: Criterion[] = [
  {
    id: "C1",
    text: "Creating a room from home retains Player 1's connection through navigation to /game/[roomId].",
    evidence: [
      {
        file: "tests/battle.spec.ts",
        title:
          "invite flow and a complete mouse-controlled 1v1 reach the same winner",
      },
    ],
  },
  {
    id: "C2",
    text: "Copying the invitation joins Player 2; a lone player waits and a third player is rejected.",
    evidence: [
      {
        file: "tests/battle.spec.ts",
        title:
          "invite flow and a complete mouse-controlled 1v1 reach the same winner",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title:
          "waits for two players, starts once and rejects extra or duplicate players",
      },
      {
        file: "apps/game-server/src/server.test.ts",
        title:
          "a lone waiting disconnect disposes the room and new players get a fresh room",
      },
    ],
  },
  {
    id: "C3",
    text: "Both browsers render the same authoritative rocket, HP, positions, turn and winner.",
    evidence: [
      {
        file: "tests/battle.spec.ts",
        title:
          "invite flow and a complete mouse-controlled 1v1 reach the same winner",
      },
      {
        file: "apps/game-server/src/server.test.ts",
        title:
          "two clients share a schema match, rejected actions report errors, shots sync, disconnect forfeits",
      },
    ],
  },
  {
    id: "C4",
    text: "Both players aim, hold to charge, release to fire and alternate turns; idle turns expire after 15 seconds.",
    evidence: [
      {
        file: "tests/battle.spec.ts",
        title: "mobile touch charges and fires without scrolling the arena",
      },
      {
        file: "tests/battle.spec.ts",
        title:
          "idle timeout passes the turn and disconnect awards the remaining player",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title: "counts down and passes a 15 second idle turn",
      },
    ],
  },
  {
    id: "C5",
    text: "Splash damage can remove all 100 HP through normal fire intentions, then both browsers show the same winner.",
    evidence: [
      {
        file: "tests/battle.spec.ts",
        title:
          "invite flow and a complete mouse-controlled 1v1 reach the same winner",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title: "maximum damage is 55 and applied once per explosion",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title:
          "a full unmodified match is reproducible from deterministic aim intents",
      },
    ],
  },
  {
    id: "C6",
    text: "Invalid inputs, stale or duplicate shots and out-of-turn actions never change gameplay outcomes.",
    evidence: [
      {
        file: "apps/game-server/src/Battle.test.ts",
        title:
          "rejects waiting, wrong player, unknown player, stale turns, and double fire",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title: "fire cannot sneak past a deadline when the tick stalls",
      },
      {
        file: "apps/game-server/src/Battle.test.ts",
        title:
          "an old intent is stale even when the same player's next turn arrives",
      },
    ],
  },
];

function checkEvidence() {
  const cache = new Map<string, string>();
  const missing: string[] = [];
  for (const criterion of CRITERIA) {
    for (const { file, title } of criterion.evidence) {
      if (!cache.has(file)) {
        cache.set(file, existsSync(file) ? readFileSync(file, "utf8") : "");
      }
      const source = cache.get(file) ?? "";
      if (!source) {
        missing.push(`${criterion.id} -> ${file} (file not found)`);
      } else if (!source.includes(`test("${title}"`)) {
        missing.push(`${criterion.id} -> ${file} :: "${title}"`);
      }
    }
  }
  return missing;
}

function printEvidence() {
  for (const criterion of CRITERIA) {
    console.info(`\n${criterion.id}  ${criterion.text}`);
    for (const { file, title } of criterion.evidence) {
      console.info(`     ${file} :: ${title}`);
    }
  }
}

function chromiumInstalled() {
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Caches", "ms-playwright")
      : process.platform === "win32"
        ? join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
        : join(homedir(), ".cache", "ms-playwright"));
  if (!existsSync(root)) return false;
  return readdirSync(root).some((entry) => entry.startsWith("chromium-"));
}

async function webServerUp() {
  try {
    await fetch("http://localhost:3000", { signal: AbortSignal.timeout(800) });
    return true;
  } catch (error) {
    return (error as Error).name === "TimeoutError";
  }
}

async function runGate(gate: Gate): Promise<number> {
  console.info(`\n── ${gate.id}: ${gate.command.join(" ")}`);
  const child = Bun.spawn(gate.command, {
    stdout: "inherit",
    stderr: "inherit",
  });
  return await child.exited;
}

const flags = process.argv.slice(2);
const only = flags
  .find((flag) => flag.startsWith("--only"))
  ?.split("=")[1]
  ?.split(",");
const selected = GATES.filter((gate) => !only || only.includes(gate.id));

const missing = checkEvidence();

if (flags.includes("--list")) {
  printEvidence();
  console.info(
    missing.length
      ? `\nUnverifiable evidence:\n  ${missing.join("\n  ")}`
      : "\nEvery criterion points at a test that exists.",
  );
  process.exit(missing.length ? 1 : 0);
}

const outcomes: Outcome[] = [];
const busyWeb = await webServerUp();

for (const gate of selected) {
  if (gate.id === "build" && busyWeb && !flags.includes("--allow-busy-web")) {
    outcomes.push({
      gate,
      status: "skip",
      note: "a dev server holds localhost:3000 and shares apps/web/.next",
    });
    continue;
  }
  if (gate.id === "e2e" && !chromiumInstalled()) {
    outcomes.push({
      gate,
      status: "skip",
      note: "run `bunx playwright install chromium` first",
    });
    continue;
  }
  const code = await runGate(gate);
  outcomes.push({
    gate,
    status: code === 0 ? "pass" : "fail",
    note: code === 0 ? "" : `exit ${code}`,
  });
}

console.info("\n══ convergence ══");
for (const { gate, status, note } of outcomes) {
  const mark = status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "SKIP";
  console.info(`  ${mark}  ${gate.id.padEnd(10)} ${note || gate.purpose}`);
}
console.info(
  missing.length
    ? `\n  Acceptance evidence broken:\n    ${missing.join("\n    ")}`
    : `\n  All ${CRITERIA.length} acceptance criteria point at tests that exist.`,
);

const failed = outcomes.filter((outcome) => outcome.status === "fail").length;
const skipped = outcomes.filter((outcome) => outcome.status === "skip").length;
if (failed || missing.length) process.exit(1);
process.exit(skipped ? 2 : 0);
