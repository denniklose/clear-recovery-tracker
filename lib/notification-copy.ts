export const PUSH_MILESTONES = [1, 3, 7, 14, 30, 50, 90, 180, 365] as const;

const DAILY_MOTIVATION = [
  "Du musst heute nicht alles lösen. Nur den nächsten guten Schritt.",
  "Ein ruhiger Tag ist auch Fortschritt.",
  "Du darfst stolz auf die Entscheidung sein, die du gerade triffst.",
  "Heute zählt nicht die perfekte Geschichte, sondern dein nächster Moment.",
  "Kleine klare Entscheidungen bauen einen neuen Weg.",
  "Du bist nicht deine schwierigste Stunde.",
  "Was heute gelingt, darf leise und trotzdem wichtig sein.",
  "Atme durch. Dein Weg muss nicht schnell sein, nur deiner.",
  "Du darfst heute wieder bei dir ankommen.",
  "Ein Tag nach dem anderen ist kein kleiner Plan. Er funktioniert.",
  "Du hast schon bewiesen, dass du anfangen kannst.",
  "Deine Aufmerksamkeit ist heute ein Geschenk an dich selbst.",
  "Auch ein langsamer Schritt führt dich aus dem alten Muster.",
  "Du musst den ganzen Weg nicht sehen, um weiterzugehen.",
  "Heute ist eine neue Gelegenheit, freundlich mit dir zu bleiben.",
  "Dein Fortschritt darf sich ungewohnt anfühlen.",
  "Halte dich an das, was dir heute Halt gibt.",
  "Ein klarer Moment kann der Anfang von etwas Größerem sein.",
  "Du bist hier. Das ist ein echter Anfang.",
  "Dein heutiger Einsatz zählt, auch wenn ihn niemand sieht.",
  "Du darfst Nein sagen, ohne dich dafür zu erklären.",
  "Zwischen Impuls und Handlung liegt ein Raum. Nimm ihn dir.",
  "Heute muss nicht perfekt werden, um gut zu sein.",
  "Du kannst dir selbst wieder vertrauen lernen.",
  "Dein Weg gehört dir. Geh ihn in deinem Tempo.",
  "Ein cleanes Heute ist genug für heute.",
  "Du darfst Unterstützung annehmen und trotzdem stark sein.",
  "Jede bewusste Pause ist eine Entscheidung für dich.",
  "Du musst nicht zurück, nur weil es gerade schwer ist.",
  "Dein nächster Schritt darf klein sein.",
] as const;

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function dailyMotivationFor(dateKey: string, deviceId: string): string {
  return DAILY_MOTIVATION[stableHash(`${dateKey}:${deviceId}`) % DAILY_MOTIVATION.length];
}

export function levelUpCopy(streak: number, milestone: boolean): { title: string; body: string } {
  if (milestone) {
    return {
      title: `Clear · ${streak} Tage`,
      body: `Dein ${streak}-Tage-Meilenstein ist geschafft. Nimm diesen Moment mit.`,
    };
  }

  return {
    title: "Clear · Level-up geschafft",
    body: `24 Stunden geschafft. Tag ${streak} gehört dir.`,
  };
}
