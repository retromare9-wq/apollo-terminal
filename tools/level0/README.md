# Digitalisierung Level 0

Die handgezeichnete Karte wurde in Kacheln abgelesen (`data_A.py` … `data_I.py`,
Pixelkoordinaten je Kachel auf dem gerade gedrehten Foto).

- `build.py` setzt die Kacheln zu `level0_px.json` zusammen.
- `process.py` richtet alles auf ein 25-px-Raster aus (≈ 1,25 m), teilt Wohn-/Lagerblöcke
  in Einzelräume, setzt die Raumtüren automatisch und schreibt `level0.js`.

Das Ergebnis liegt als `js/station-level0.js` im Projekt.

Neu erzeugen: `python3 build.py && python3 process.py`, danach `level0.js` nach `js/station-level0.js` kopieren.
Nachträgliche Korrekturen (z. B. Eingangsbereich mit Schleusen und Empfang) stehen am Ende von `process.py`.
