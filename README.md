# apollo-terminal

Interaktives Stationsterminal **A.P.O.L.L.O.** für ALIEN RPG: Die Spieler stellen am Laptop Fragen an den Stationscomputer, rufen Berichte und animierte Karten ab und nehmen über das Interkom Kontakt zu den Stationsbewohnern auf.

> **Stand: Design-Prototyp.** Chat-Antworten werden noch simuliert. Die Spielleiter-Konsole fürs Handy folgt im nächsten Schritt.

## Bedienung

| Taste | Funktion |
|---|---|
| Frage eintippen + Enter | Freie Anfrage, z. B. „Gibt es Schäden?“ |
| Buchstabe + Enter | Menüpunkt direkt wählen (A–I) |
| ↑ ↓ | Auswahl im Menü bzw. Interkom; auf Karten: eine Ebene zurück / tiefer |
| A + Enter (Karte) | Zum markierten Ziel zoomen: Sternenkarte → System → Mond → Station |
| Enter (leer) | Ausgewählten Punkt öffnen bzw. Textausgabe überspringen |
| Esc | Zurück / Verbindung trennen |
| ← → (Stationsplan) | Räume nacheinander auswählen |
| Raum-ID + Enter (Stationsplan) | Direkt zum Raum, z. B. `XENO-2`; nur die Abteilung (z. B. `XENO`) springt zum ersten Raum dieser Abteilung |
| Strg + Pfeiltasten (alle Karten) | Karte bewegen |
| + / # (alle Karten) | Hinein- / herauszoomen |
| F9 | Ton an/aus |
| F10 | Röhrenmonitor-Effekt an/aus |
| F11 | Vollbild (Browser) |

Während einer Karten-Animation überspringt jede Taste direkt zum Ziel.

## Editor (Spielleitung)

`editor.html` – über die Reiter in der Fußleiste:

- **STATIONSPLAN**: Karten-Editor (siehe unten)
- **ALLGEMEIN**: Namen von Computer, Station, Mond, Planet, Stern, Sektor; Begrüßung, Statusanzeige im Menü, Startsequenz, Interkom-Antworten
- **STERNEN-/SYSTEM-/MONDKARTE**: alle Beschriftungen und Datenzeilen der Karten
- **SCHADENSBERICHT**: Einleitung, Fälle, Hüllenintegrität, Empfehlung; Fälle mit Raum setzen den Raumstatus direkt im Stationsplan
- **BERICHTE**: Titel, Schlüsselwörter und Inhalt aller Kategorien; neue Berichte anlegen
- **MENÜ** und **PERSONAL**: Hauptmenü und Stationsbewohner

Alle Texte werden im Browser gespeichert, das Terminal übernimmt sie sofort. **Exportieren**
sichert Karte, Ausrüstung und Texte in einer Datei.

### Stationsplan

`editor.html` – Türen (Sicherheitsstufe Grün / Orange / Rot), graue Trennlinien, Kameras mit
Sichtkegel (Richtung und Reichweite einstellbar, fester Öffnungswinkel) sowie Raumname, Status
und Notiz eintragen.

| Taste | Werkzeug |
|---|---|
| 1 | Auswahl / Verschieben (freie Fläche ziehen = Karte bewegen) |
| 2 | Tür (in einen Gang oder an eine Raumwand klicken) |
| 3 | Trennlinie (Anfang und Ende klicken) |
| 4 | Kamera (gelben Punkt ziehen = Richtung und Reichweite) |
| 5 | Raum: ID, Name, Bereich, Status, Notiz · „Raumbeschreibung öffnen“ für Ästhetik, Sinneseindrücke, Untersuchung, Gegenstände und Piktogramme |
| 6 | Radierer |
| 7 | Piktogramm (Semiotic Standard, bis zu 5 pro Raum) |
| 8 | Beschriftung setzen (vorhandene mit Werkzeug 1 anklicken, umbenennen, verschieben) |
| G / O / R | Sicherheitsstufe (auch für die gewählte Tür) |
| Entf · Strg+Z · Strg+Y | Löschen · Rückgängig · Wiederholen |

Aufzüge anklicken öffnet das Aufzugsmenü (Buchstabe, Sicherheitsstufe, „Zugang zu“).
**Raumliste PDF/ODT** exportiert alle Räume mit sämtlichen Angaben.

Gespeichert wird automatisch im Browser; ein offenes Terminal im selben Browser übernimmt
Änderungen sofort. **Exportieren** lädt die Ebene als JSON-Datei herunter (Sicherung oder
Übertragung auf ein anderes Gerät per **Importieren**). Eine exportierte Datei kann als
Vorgabe in `js/station-layer0.js` übernommen werden.

## Inhalte anpassen

Alle Texte stehen in [`js/data.js`](js/data.js):

- `CONFIG`: Namen von Station, Mond, Planet und System sowie die Begrüßung
- `TOPICS`: Informationskategorien mit Schlüsselwörtern und Berichtsinhalt (Text, Warnungen, Tabellen, Balkenanzeigen)
- `MENU`: Hauptmenü
- `STATION`: Ebenen des Stationsplans (Grundriss aus `js/station-level0.js`, editierbare Ebene aus dem Karten-Editor)
- `PERSONNEL`: Bewohner für das Interkom (optional mit Profilbild)

Wörter wie KRITISCH, WARNUNG, OFFLINE oder NICHT ERREICHBAR werden in Berichten automatisch eingefärbt.

## Lokal starten

```sh
npx http-server -c-1 .
```

Danach `http://localhost:8080` im Browser öffnen.

## Tests

```sh
npm test
```
