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
| ← → (Stationsplan) | Räume nacheinander auswählen; alternativ Raum-ID eintippen, z. B. `XENO-2` |
| F2 | Bearbeitungsmodus (Spielleitung): im gewählten Raum **K** = Kamera an/aus, **S** = Status wechseln |
| F9 | Ton an/aus |
| F10 | Röhrenmonitor-Effekt an/aus |
| F11 | Vollbild (Browser) |

Während einer Karten-Animation überspringt jede Taste direkt zum Ziel.

Änderungen aus dem Bearbeitungsmodus speichert der Browser des Geräts. Vorgaben: Status in `js/data.js` (`STATION.status`), Kameras aus den grünen Punkten der Zeichnung.

## Inhalte anpassen

Alle Texte stehen in [`js/data.js`](js/data.js):

- `CONFIG`: Namen von Station, Mond, Planet und System sowie die Begrüßung
- `TOPICS`: Informationskategorien mit Schlüsselwörtern und Berichtsinhalt (Text, Warnungen, Tabellen, Balkenanzeigen)
- `MENU`: Hauptmenü
- `STATION`: Module und Gänge für den Stationsplan
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
