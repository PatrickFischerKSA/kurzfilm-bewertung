# Kurzfilm Heimat – gemeinsam bewerten

**Anwendung öffnen:** https://patrickfischerksa.github.io/kurzfilm-bewertung/

Kollaboratives Bewertungstool für zwei Lehrpersonen in Deutsch und Kommunikation. Die Oberfläche wird von **GitHub Pages** ausgeliefert. Der gemeinsam genutzte Speicher läuft als eigener Cloudflare Worker mit eigener D1-Datenbank im Konto des Projektinhabers. **Die Anwendung benötigt kein ChatGPT-Sites-Projekt. Das frühere Sites-Projekt kann gelöscht werden.**

## Verwendung

1. Bewertungsraum erstellen und dessen geheimen Link als Lesezeichen speichern.
2. Den Raumlink persönlich mit der zweiten Lehrperson teilen.
3. Filme und Gruppenmitglieder erfassen; in den beiden Fachreitern bewerten.
4. Unter „Raster & Regeln“ Rundung und Abspannregel vereinbaren.
5. Rückmeldung ausdrucken bzw. als PDF speichern; Notenübersicht als CSV oder alle Eingaben als JSON exportieren.

Beide Lehrpersonen können alle Eingaben lesen und bearbeiten. Die Fachreiter sind keine Zugriffsrollen. Textfelder speichern beim Verlassen, Punkte sofort. Andere Geräte werden etwa alle vier Sekunden abgeglichen; während einer Texteingabe pausiert der Abgleich. Gleichzeitige Änderungen desselben Feldes müssen ausdrücklich aufgelöst werden. Bei einer Verbindungsunterbrechung bleiben noch nicht gespeicherte Eingaben im geöffneten Fenster; dieses bis zur erfolgreichen Speicherung offen lassen.

## Bewertung

Grundlage ist `Bewertungsraster_Kurzfilm_definitiv.docx`, mit den gewünschten Anpassungen „gedankliche Tiefe“ und einfacher Gewichtung des ersten Kriteriums in beiden Fächern.

- Je Fach sechs Kriterien mit Gewichten **1, 2, 1, 1, 1, 1**; maximal **28 Punkte**.
- Kriterien 1–5: Film, maximal 24 Punkte. Kriterium 6: Storyboard, maximal 4 Punkte.
- Stufen 0–4; noch offene Kriterien sind keine Nullbewertung. Noten erscheinen erst nach vollständiger Bewertung.
- Fehlendes Storyboard: Kriterium 6 in beiden Fächern automatisch null. Eine zuvor erfasste Storyboard-Bewertung bleibt intern erhalten.
- Formel: `1 + 5 × Punkte / 28`. Rundung auf Zehntelnoten, halbe Noten oder ungerundet (Anzeige auf vier Dezimalstellen).
- Zwei Gruppennoten, kein Gesamtmittel; Laufzeitabweichungen führen nicht automatisch zu Abzügen.

## Unabhängiger Betrieb

| Bestandteil | Betrieb |
| --- | --- |
| Benutzeroberfläche | GitHub Pages unter `/kurzfilm-bewertung/` |
| API | `https://kurzfilm-bewertung-api.patrick-fischer.workers.dev` |
| Datenbank | Cloudflare D1 `kurzfilm-bewertung` |
| Bereitstellung Oberfläche | GitHub Actions nach Änderungen an `main` |
| Bereitstellung API | `npm run deploy:api` mit Cloudflare-Anmeldung |

Die API erlaubt Browserzugriffe von `https://patrickfischerksa.github.io`. Der Raumzugriff erfordert zusätzlich den geheimen Raumschlüssel. Links enthalten einen zufälligen 256-Bit-Schlüssel im Fragment; gespeichert wird dessen SHA-256-Hash. API-Antworten sind nicht zwischenspeicherbar. Keine externen Schriftarten, Analysedienste oder Film-Uploads.

Namen, Bewertungen, Raumlinks und Zugangsschlüssel liegen **nicht im GitHub-Repository**. Das öffentliche Repository enthält ausschliesslich den Programmcode und die Konfiguration ohne Geheimnisse. Jeder mit Raumlink besitzt Bearbeitungszugang; verlorene Links können nicht wiederhergestellt werden. JSON-Exporte enthalten die Bewertungen, aber keinen Raumschlüssel; aktuell gibt es keinen JSON-Import und keine automatische Löschfrist.

## Entwicklung

Node.js >= 22.13:

```sh
npm install
npm run check
npm test
npm run build
```

Lokale Datenbank vorbereiten und API starten:

```sh
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc --persist-to .wrangler/independent
npm run dev:api -- --var 'ALLOWED_ORIGINS:http://127.0.0.1:5173,http://localhost:5173'
```

In einem zweiten Terminal die Oberfläche mit lokaler API starten:

```sh
VITE_API_URL=http://127.0.0.1:8787/api/rooms npm run dev
```

Die Oberfläche öffnet unter `http://127.0.0.1:5173/kurzfilm-bewertung/`. Ohne `VITE_API_URL` nutzt sie den eigenständigen Produktivdienst. Lokale Datenbank und Produktion sind getrennt.

```sh
node tests/api.mjs http://127.0.0.1:8787
```

API-Tests erzeugen ausschliesslich Testdaten in der angegebenen lokalen Vorschau. Sie prüfen Raumtrennung, Autorisierung, Eingabegrenzen, parallele Fachbewertungen und Bearbeitungskonflikte.

## Veröffentlichung

Die fertige Oberfläche wird im Ordner `docs/` zusammen mit dem Quellcode versioniert. GitHub Actions veröffentlicht genau diesen geprüften Stand; auf dem Veröffentlichungsserver ist keine Paketinstallation nötig. Vor Änderungen `npm run check`, `npm test` und `npm run build` ausführen und den aktualisierten Ordner `docs/` mit committen. Dafür werden keine Cloudflare-Zugangsdaten benötigt.

API-Änderungen separat bereitstellen:

```sh
npx wrangler login
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
npm run deploy:api
```

Nach Schemaänderungen `npm run db:generate` ausführen und die neue SQL-Migration prüfen. Bestehende Migrationen nicht verändern. Nach Änderungen der Cloudflare-Konfiguration `npx wrangler types --config wrangler.jsonc` ausführen. Datenbank sichern:

```sh
npx wrangler d1 export DB --remote --config wrangler.jsonc --output /sicherer/pfad/kurzfilm-backup.sql
```

Backups niemals in das öffentliche Repository aufnehmen.

## Ablösung von Sites

Am 25. September 2026 wurden die drei Tabellen `rooms`, `films` und `fields` der früheren Sites-Datenbank geprüft; sie waren leer. Es gab keine bestehenden Bewertungen zu übertragen. Neue Räume werden ausschliesslich über den GitHub-Link erstellt und im eigenständigen Cloudflare-Konto gespeichert. Die alte Sites-Anwendung wurde nicht automatisch gelöscht; sie wird für diese Anwendung nicht mehr benötigt.

## Projektstruktur

- `app/page.tsx`, `app/globals.css`: Oberfläche, Zusammenarbeit, Druck und Export
- `main.tsx`, `index.html`, `vite.config.ts`: eigenständige GitHub-Pages-Anwendung
- `docs/`: fertig gebaute und direkt auf GitHub veröffentlichte Oberfläche
- `lib/rubric.json`, `lib/model.ts`: Raster und Notenberechnung
- `lib/deployment.ts`: öffentliche API-Adresse und korrekte Raumlinks
- `server/`: Cloudflare-API mit CORS und versionsgesicherten Änderungen
- `wrangler.jsonc`, `db/schema.ts`, `drizzle/`: unabhängige Datenbank und Migrationen
