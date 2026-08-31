/**
 * ------------------------------------------------------------------
 * Prompt Utilities
 * ------------------------------------------------------------------
 * Tiện ích hỏi người dùng qua terminal.
 * Hỗ trợ interactive và non-interactive mode.
 *
 * Main functions:
 * - askUser()   : Hỏi người dùng và nhận input
 * - askYesNo()  : Hỏi yes/no và trả về boolean
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import readline from 'readline';

// ─── Functions ──────────────────────────────────────────────────────────

export const askUser = (question: string): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

export const askYesNo = async (question: string): Promise<boolean | null> => {
  const answer = await askUser(`${question} (y/n) `);
  if (answer === null) return null;
  return answer === 'y' || answer === 'yes';
};