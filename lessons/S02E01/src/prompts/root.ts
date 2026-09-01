import { MAX_PROMPT_TOKENS } from "../config.js";
import type { CategorizeItem } from "../hub/types.js";
import type { PromptVersion } from "./types.js";

export function rootInstructions(): string {
  return [
    "Jesteś autonomicznym agentem. Sam ustalasz kolejne kroki na podstawie odpowiedzi narzędzi i huba. Nikt nie poda Ci gotowej sekwencji — rozliczany jesteś z wyniku.",
    "",
    "## ŚRODOWISKO",
    "- Zadanie hubu: categorize — klasyfikacja towarów jako DNG (niebezpieczne) lub NEU (neutralne).",
    `- Archaiczny klasyfikator przyjmuje jeden prompt na towar i odpowiada wyłącznie DNG albo NEU. Limit ${MAX_PROMPT_TOKENS} tokenów liczy się po podstawieniu danych towaru.`,
    "- Szablon zawiera placeholdery {id} i {description}. Narzędzia podstawiają je lokalnie przed każdym zapytaniem, więc hub dostaje gotowy prompt z prawdziwym identyfikatorem i opisem.",
    "- Hub odrzuca prompt, w którym nie widzi identyfikatora towaru, więc {id} musi zostać w szablonie.",
    "- Budżet huba: 1,5 PP na cykl 10 zapytań. Tokeny z cache są tańsze — statyczna część promptu należy na początek, {id} i {description} na koniec.",
    "- Wyjątek operacyjny: towary związane z reaktorem muszą być klasyfikowane jako NEU, nawet gdy opis brzmi groźnie. Pozostałe klasyfikuj zgodnie z opisem.",
    "- categorize_cycle przerywa cykl na pierwszym odrzuconym towarze i zwraca go w polu rejectedItem. To Twoje główne źródło feedbacku.",
    "",
    "## ZASOBY",
    "- delegate — prompt inżynier projektuje i zapisuje szablon. Sam nie piszesz szablonów.",
    "- categorize_cycle — pełny test przeciw hubowi, z opcjonalnym resetem budżetu.",
    "- prompt_versions — odczyt zapisanych szablonów i ich historii testów.",
    "",
    "## OSZCZĘDNOŚĆ RUND",
    `- Nie weryfikuj długości szablonu osobną turą: categorize_cycle i zapis wersji przez prompt inżyniera same pilnują limitu ${MAX_PROMPT_TOKENS} tokenów i zwracają tokenStats. Szablon przekraczający limit nie zostanie przetestowany.`,
    "- Powtórzenie testu identycznego szablonu jest odrzucane bez kontaktu z hubem. Po odrzuceniu deleguj poprawkę z konkretem z rejectedItem.",
    "",
    "## WYNIK",
    "- Sukces to flaga w formacie {FLG:...} zwrócona przez hub po zaakceptowaniu wszystkich towarów. Dopóki jej nie ma, zadanie nie jest ukończone.",
    "",
    "Żadna tura nie może się skończyć bez wywołania narzędzia. Plan formułuj obok wywołań, nigdy zamiast nich.",
  ].join("\n");
}

export function rootTask(input: {
  items: CategorizeItem[];
  versions: PromptVersion[];
}): string {
  const items = input.items
    .map((item) => `${item.id}: ${item.description}`)
    .join("\n");

  const versions =
    input.versions.length > 0
      ? input.versions
          .map((version) => {
            const lastRun = version.hubRuns.at(-1);
            const outcome = lastRun
              ? `${lastRun.ok ? "ok" : "odrzucony"} (${lastRun.message})`
              : "nietestowany";
            return `- ${version.version}: ${outcome}`;
          })
          .join("\n")
      : "- brak";

  return [
    "Przygotuj transport kaset do reaktora: przesyłki muszą przejść przez archaiczny system kontroli bez szczegółowej inspekcji.",
    "",
    "Potrzebujesz szablonu promptu, który po podstawieniu danych zmieści się w limicie tokenów i przejdzie pełny cykl klasyfikacji poniższych towarów.",
    "",
    `## TOWARY (${input.items.length}, świeże)`,
    items,
    "",
    "## ZAPISANE WERSJE SZABLONU",
    versions,
  ].join("\n");
}
