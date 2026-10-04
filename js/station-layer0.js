// Vorgabe für die editierbare Ebene von Level 0 (Türen, Trennlinien, Kameras, Raumdaten).
// Leer = alles wird im Karten-Editor (editor.html) gesetzt. Eine exportierte Datei aus dem
// Editor kann hier eingefügt werden, damit sie auf jedem Gerät als Startstand gilt.
export const LAYER0 = {
  doors: [],
  lines: [],
  cams: [],
  rooms: {},
  settings: { showCams: true },
};
