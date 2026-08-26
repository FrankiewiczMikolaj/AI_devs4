import { TARGET_ROUTE } from "../config.js";

export function buildTaskMessage(): string {
  return [
    `Aktywuj trasę kolejową ${TARGET_ROUTE}: oznacz ją jako otwartą w systemie sterowania trasami.`,
    "",
    "Znasz nazwę zadania po stronie hubu (railway) oraz to, że API obsługuje akcję help zwracającą własną dokumentację. Zacznij od niej, jeśli nie znasz dostępnych działań.",
  ].join("\n");
}
