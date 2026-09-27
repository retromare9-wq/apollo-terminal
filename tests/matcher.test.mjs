import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchTopic, normalize, distance } from '../js/matcher.js';
import { TOPICS, MENU } from '../js/data.js';

const id = (q) => matchTopic(q, TOPICS)?.topic.id ?? null;

test('normalize entfernt Umlaute und Satzzeichen', () => {
  assert.equal(normalize('Gibt es Schäden?!'), 'gibt es schaeden');
  assert.equal(normalize('A.P.O.L.L.O.'), 'a p o l l o');
});

test('distance zählt Vertauschungen als einen Fehler', () => {
  assert.equal(distance('schdaen', 'schaden'), 1);
  assert.equal(distance('reaktor', 'reaktor'), 0);
});

test('typische Fragen landen in der richtigen Kategorie', () => {
  const cases = {
    'Gibt es irgendwelche Schäden auf der Station?': 'schaden',
    'Schadensbericht': 'schaden',
    'Wie ist der Sauerstoffgehalt?': 'lebenserhaltung',
    'Status des Reaktors': 'energie',
    'Gibt es einen Stromausfall?': 'energie',
    'Wie ist die Lage?': 'status',
    'Zeig mir den Lageplan': 'stationsplan',
    'Welche Planeten gibt es im System?': 'sonnensystem',
    'Wo befinden wir uns?': 'sterne',
    'Sternenkarte': 'sterne',
    'Mondkarte bitte': 'mond',
    'Ich möchte jemanden anrufen': 'interkom',
    'Wer bist du?': 'apollo',
    'Wer ist auf der Station?': 'personal',
    'Hilfe': 'hilfe',
  };
  for (const [q, expected] of Object.entries(cases)) assert.equal(id(q), expected, q);
});

test('Tippfehler werden toleriert', () => {
  assert.equal(id('schdaen?'), 'schaden');
  assert.equal(id('sauerstof'), 'lebenserhaltung');
});

test('Unbekanntes ergibt keinen Treffer', () => {
  assert.equal(id('Banane'), null);
  assert.equal(id(''), null);
});

test('jeder Menüeintrag verweist auf eine vorhandene Kategorie', () => {
  for (const m of MENU) assert.ok(TOPICS.some((t) => t.id === m.topic), m.topic);
});
