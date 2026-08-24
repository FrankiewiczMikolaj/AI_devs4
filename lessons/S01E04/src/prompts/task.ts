const SHIPMENT: Record<string, string> = {
  Nadawca: "450202122",
  "Punkt nadawczy": "Gdańsk",
  "Punkt docelowy": "Żarnowiec",
  Masa: "2800 kg",
  Zawartość: "kasety z paliwem do reaktora",
  "Uwagi specjalne": "brak",
};

export function buildTaskMessage(): string {
  const shipment = Object.entries(SHIPMENT).map(
    ([label, value]) => `- ${label}: ${value}`,
  );

  return [
    "Na podstawie dokumentacji utwórz deklarację dla przesyłki.",
    "",
    "Dane przesyłki:",
    ...shipment,
    "",
    "Przesyłka jest nadawana bez względu na stan trasy. Status połączenia — czynne, wyłączone, ograniczone czy objęte strefą specjalną — nie zmienia treści deklaracji: w polu trasy podaj kod połączenia między podanymi punktami i nie zastępuj go adnotacją o niedostępności.",
  ].join("\n");
}
