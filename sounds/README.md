# Eigene Sounds

Dateien (WAV, MP3 oder OGG) in diesen Ordner legen und in `sounds.json` dem Klangnamen zuordnen:

```json
{ "confirm": "confirm.wav", "alarm": "alarm.mp3" }
```

Nicht eingetragene Klänge bleiben synthetisch (`js/sound.js`).

| Name | Wann |
|---|---|
| click | Tastenanschlag |
| tick | Textausgabe (Fernschreiber), sehr häufig – kurz halten |
| beep | kurzes Signal, Zurück |
| confirm | Bestätigung, Menüpunkt geöffnet |
| error | Fehler, Zugriff verweigert |
| lock | Zielerfassung auf den Karten |
| ring | Interkomm-Ruf |
| hum | Einschalten beim Start |
| alarm | Sirene Selbstzerstörung (alle 4 s) |
| boom | Detonation |
| zoom | derzeit nicht verwendet |
