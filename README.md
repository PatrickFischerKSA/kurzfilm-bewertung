# Kurzfilm Heimat – gemeinsam bewerten

Ein kollaboratives Bewertungstool für zwei Lehrpersonen in Deutsch und Kommunikation, basierend auf `Bewertungsraster_Kurzfilm_definitiv.docx`.

**Anwendung:** https://kurzfilm-heimat-bewertung.patrickoliverfischer.chatgpt.site

## Verwendung

1. Bewertungsraum mit Klassenbezeichnung erstellen.
2. Den geheimen Raumlink als Lesezeichen speichern und der zweiten Lehrperson persönlich weitergeben.
3. Filme hinzufügen, Gruppenmitglieder erfassen und in den Fachreitern bewerten.
4. Unter „Raster & Regeln“ die schulische Rundung und Abspannregel vereinbaren.
5. Gemeinsam Rückmeldungen formulieren und ausdrucken bzw. als PDF speichern. CSV enthält die Notenübersicht, JSON alle gespeicherten Bewertungen und Kommentare.

Beide Lehrpersonen können alle Eingaben sehen und bearbeiten. Die Fachreiter trennen die Bewertung, sie sind keine Zugriffsrollen. Textfelder speichern beim Verlassen, Punktwerte sofort. Änderungen anderer Geräte werden etwa alle vier Sekunden geladen; während einer Texteingabe pausiert dieser Abgleich, damit Eingaben nicht überschrieben werden. Gleichzeitige Änderungen desselben Feldes müssen ausdrücklich aufgelöst werden. Bei unterbrochener Verbindung bleiben noch ungespeicherte Eingaben im geöffneten Fenster; dieses bis zur erfolgreichen Speicherung offen lassen.

## Bewertung

- Je Fach sechs Kriterien mit den Gewichten 1, 2, 1, 1, 1, 1; maximal 28 Punkte.
- Kriterien 1–5: Film, maximal 24 Punkte. Kriterium 6: Storyboard, maximal 4 Punkte.
- Bewertung je Kriterium 0–4. Noch offene Kriterien zählen nicht als Nullbewertung; eine Fachnote wird erst bei sechs bewerteten Kriterien angezeigt.
- Fehlendes Storyboard erzwingt in beiden Fächern für Kriterium 6 null Punkte. Eine zuvor erfasste Storyboard-Bewertung bleibt intern erhalten, wird aber erst wieder berücksichtigt, wenn der Status auf „Vorhanden“ gesetzt wird.
- Formel mit angepasster Gewichtung: `1 + 5 × Punkte / 28`. Einstellbar: Zehntelnoten (Voreinstellung des Tools), halbe Noten oder ungerundet (Anzeige mit vier Dezimalstellen).
- Die Vorlage ergibt zwei Gruppennoten. Kein Gesamtmittel und keine automatischen individuellen Abzüge.
- Laufzeitabweichungen werden nur angezeigt, nicht automatisch abgezogen.

Bestehende Bewertungen werden mit der neuen Gewichtung neu berechnet; die vergebenen Stufen von 0–4 und Kommentare bleiben erhalten.

## Speicherung und Zugang

Die Anwendung ist öffentlich aufrufbar. Raumdaten sind nur mit dem geheimen Raumlink zugänglich. Der Link enthält einen zufälligen 256-Bit-Schlüssel im URL-Fragment; der Server speichert dessen SHA-256-Hash. Der Schlüssel wird für API-Abfragen im Authorization-Header übertragen. API-Antworten sind nicht zwischenspeicherbar. Keine externen Schriftarten, Analysedienste oder Video-Uploads.

Namen, Bewertungen und Raumlinks werden **nicht in GitHub** gespeichert. Bewertungen liegen in der D1-Datenbank des bereitgestellten Sites-Projekts. Wer einen Raumlink erhält, besitzt vollständigen Bearbeitungszugang; es gibt keine Wiederherstellung eines verlorenen Links und keine individuellen Benutzerkonten. Die Sicherung enthält Bewertungen, aber keinen Zugangsschlüssel. Räume haben derzeit keine automatische Löschfrist und keine Wiederherstellungsfunktion für JSON-Exporte.

## Entwicklung

Node.js >= 22.13:

```sh
npm ci
npm run db:generate # nur nach Änderungen an db/schema.ts
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_goofy_adam_destine.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_eminent_jigsaw.sql
npm run dev
```

Der konkrete Migrationsdateiname liegt in `drizzle/`; bereits angewendete Migrationen nicht erneut ausführen. Die lokale Datenbank ist von den produktiven Bewertungen getrennt. Produktion wird über Sites bereitgestellt, da GitHub Pages allein keine gemeinsam beschreibbare Datenbank betreibt.

```sh
npx tsc --noEmit
node tests/model.cjs
node tests/api.mjs http://localhost:5173
```

Der API-Test erzeugt ausschliesslich Testdaten in der angegebenen lokalen Vorschau. Getestet werden getrennte Räume, Autorisierung, gewichtete Punkte, Eingabegrenzen und Konflikte gleichzeitiger Bearbeitung.

## Projektstruktur

- `lib/rubric.json`: vollständige Kriterien, Bewertungsstufen und Hinweise der Vorlage
- `lib/model.ts`: Validierung und Notenberechnung
- `app/page.tsx`: Oberfläche, Zusammenarbeit, Rückmeldungen und Exporte
- `app/api/rooms/route.ts`: autorisierte Raumzugriffe und versionsgesicherte Einzeländerungen
- `db/schema.ts`, `drizzle/`: persistente Datenstruktur und Migrationen

Die mitgelieferten Framework-Komponenten und Werkzeuge stammen aus dem Sites-Starter; der fachliche Inhalt wurde aus der bereitgestellten Vorlage übernommen.
