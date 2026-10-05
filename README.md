# apollo-terminal

Interaktives Stationsterminal **A.P.O.L.L.O.** für ALIEN RPG: Die Spieler stellen am Laptop Fragen an den Stationscomputer, rufen Berichte und animierte Karten ab und nehmen über das Interkomm Kontakt zu den Stationsbewohnern auf.

> **Stand: Design-Prototyp.** Chat-Antworten werden noch simuliert. Die Spielleiter-Konsole fürs Handy folgt im nächsten Schritt.

## Anmeldung & Zugangsstufen

Nach dem Start fragt A.P.O.L.L.O. nach der Identität:

- **Name eintippen + Enter**, danach Zugangsstufe wählen: **Grün**, **Orange**, **Rot** oder **Direktzugang Mainframe**
- **[A] Gastzugang**: automatisch Stufe Grün
- **[B] Direktzugang Mainframe (Computerraum)**: Stufe Rot plus Selbstzerstörung

| Stufe | Sichtbar |
|---|---|
| Grün | Stationsplan, Mond-, System-, Sternenkarte, Interkomm, Hilfe |
| Orange | zusätzlich Berichte (Schaden, Lebenserhaltung, Energie …) und **KOMMLOG** |
| Rot | zusätzlich **ZUGRIFF STATIONSSYSTEME** |
| Mainframe | zusätzlich **SELBSTZERSTÖRUNG EINLEITEN** |

Die Menütasten (A, B, C …) werden je nach Stufe automatisch vergeben (W und X sind reserviert).
Gesperrte Kategorien melden bei freier Eingabe „ZUGRIFF VERWEIGERT“. Benutzer und Stufe stehen
unten rechts; die Stationswerte im Hauptmenü erscheinen erst ab Orange.

Von überall im Terminal: **W + Enter** wechselt die Zugangsstufe, **X + Enter** verlässt das
Terminal (zurück zum allerersten Bildschirm).

**Selbstzerstörung:** beliebigen Code eingeben, mit `JA` bestätigen → Countdown mit Alarm.
Im Selbstzerstörungs-Fenster bricht `ABBRUCH` (danach Code) ab; neu laden setzt alles zurück.

## Bedienung

| Taste | Funktion |
|---|---|
| Frage eintippen + Enter | Freie Anfrage, z. B. „Gibt es Schäden?“ |
| Buchstabe + Enter | Menüpunkt direkt wählen |
| ↑ ↓ | Auswahl im Menü bzw. Interkomm; auf Karten: eine Ebene zurück / tiefer |
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

- **ALLGEMEIN**: Namen von Computer, Station, Mond, Planet, Stern, Sektor; Kennung und Datum im Infokasten oben rechts; Begrüßung, Statusanzeige, Startsequenz, Interkomm-Antworten
- **MENÜ**: Hauptmenü mit Zugangsstufe je Kategorie
- **STATION**: Karten-Editor des Stationsplans (siehe unten)
- **STERN / SYSTEM / MOND**: Beschriftungen der Karten; auf der Sternenkarte Systeme und Sektoren benennen
- **SCHÄDEN**: Schadensbericht; Fälle mit Raum setzen den Raumstatus im Stationsplan
- **BERICHTE**: alle Kategorien für die freie Eingabe (siehe unten)
- **PERSONAL**: Stationsbewohner für das Interkomm
- **KOMMLOG**, **SYSTEME**, **SELBSTZERSTÖRUNG**: Inhalte der jeweiligen Bereiche

### Berichte und Infos

Tippt jemand eine Frage ein, vergleicht A.P.O.L.L.O. die Wörter mit den Schlüsselwörtern aller
Kategorien und ihrer **Infos** und zeigt den besten Treffer. Jede Kategorie kann beliebig viele
Infos haben – jeweils mit Titel, Zugangsstufe, Fragen (exakt eingetippt = sicherer Treffer),
Schlüsselwörtern und einem oder mehreren Inhaltsbausteinen (Text, Warnmeldung, Tabelle, Balkenanzeige).

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
| 5 | Raum: ID (Häkchen „AUF KARTE“ zeigt sie im Plan, mit Werkzeug 1 im Raum verschiebbar), Name, Bereich, Status, Notiz · „Raumbeschreibung öffnen“ für Ästhetik, Sinneseindrücke, Untersuchung, Gegenstände und Piktogramme |
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

## Sounds

Alle Klänge werden in [`js/sound.js`](js/sound.js) synthetisch erzeugt. Eigene Dateien kommen in
[`sounds/`](sounds/README.md) und werden in `sounds/sounds.json` einem Klang zugeordnet.

## Inhalte anpassen

Alle Texte stehen in [`js/data.js`](js/data.js):

- `CONFIG`: Namen von Station, Mond, Planet und System sowie die Begrüßung
- `TOPICS`: Informationskategorien mit Schlüsselwörtern und Berichtsinhalt (Text, Warnungen, Tabellen, Balkenanzeigen)
- `MENU`: Hauptmenü
- `STATION`: Ebenen des Stationsplans (Grundriss aus `js/station-level0.js`, editierbare Ebene aus dem Karten-Editor)
- `PERSONNEL`: Bewohner für das Interkomm (optional mit Profilbild)

Wörter wie SCHADEN, WARNUNG, OFFLINE oder NICHT ERREICHBAR werden in Berichten automatisch eingefärbt.

Die Sternenkarte ist eine Vektor-Nachzeichnung der Vorlage „Stars of the Middle Heavens“
(`js/starmap-data.js`, erzeugt mit den Skripten in `tools/starmap`).

## Lokal starten

```sh
npx http-server -c-1 .
```

Danach `http://localhost:8080` im Browser öffnen.

## Tests

```sh
npm test
```
