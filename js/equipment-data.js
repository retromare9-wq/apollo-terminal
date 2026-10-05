// Equipment-Katalog. Quelle: ALIEN RPG Evolved Edition Core Rulebook ("Evolved")
// und ein Ergänzungsbuch ("Supplement"). Bei Dopplungen gelten die Evolved-Werte.
// kind: weapon → landet in Weapons, armor → Armor, gear → Gear.

const W = (cat, name, modifier, damage, range, ammo, weight, cost, effect = '', source = 'Evolved', extra = {}) =>
  ({ kind: 'weapon', cat, name, modifier, damage, range, ammo, weight, cost, effect, source, ...extra });
const A = (cat, name, armor, air, weight, cost, effect = '', source = 'Evolved') =>
  ({ kind: 'armor', cat, name, armor, air, weight, cost, effect, source });
const G = (cat, name, weight, cost, effect = '', source = 'Evolved', extra = {}) =>
  ({ kind: 'gear', cat, name, weight, cost, effect, source, ...extra });

export const CATEGORIES = [
  'Handguns', 'Rifles', 'Heavy Weapons', 'Grenades & Explosives', 'Close Combat Weapons',
  'Suits & Armor', 'Protective Gear', 'Fatigues',
  'Tools', 'Medical Supplies', 'Vision Devices', 'Diagnostics & Display', 'Data Storage',
  'Food & Drink', 'Pharmaceuticals', 'Other Equipment',
];

const S = 'Supplement';

const ITEMS = [
  // ---------- Handguns ----------
  W('Handguns', 'M4A3 Service Pistol', '+2', '2', 'A/M', '2', '½', '$200'),
  W('Handguns', 'VP-70MA6 Service Pistol', '+2', '2', 'A/M', '2', '¼', '$250'),
  W('Handguns', '.357 Magnum Revolver', '+1', '3', 'S/M', '1', '1', '$300'),
  W('Handguns', 'Watatsumi DV-303 Bolt Gun', '−1', '3', 'A/S', 'Single-shot', '1', '$400', 'Armor piercing. Eigentlich ein Werkzeug für Hüllenreparaturen.'),
  W('Handguns', 'Weyland ES-4 Electrostatic Pistol', '+1', '1 (stun)', 'S/M', '1', '½', '$1,000', 'Armor piercing.'),
  W('Handguns', 'Rexim RXF-M55 EVA Pistol', '+1', '1', 'S/M', '4', '½', '$400', 'Armor piercing. Ein LAG (Laser Attunement Guide) kann ergänzt werden.'),
  W('Handguns', 'M72 Starshell Flare Pistol', '−2', '1', 'Long', '', '1', '$50', 'Erleuchtet eine Zone. Jede verursachte Critical Injury ist #15.', S),
  W('Handguns', 'Hyperdyne .357 Frontier Revolver', '+1', '2', 'Medium', '', '1', '$200', '', S),
  W('Handguns', 'Gorham .44 Magnum Pistol', '', '3', 'Medium', '', '1', '$600', 'Armor piercing. Unter Strength 3: −1 auf Ranged Combat.', S),
  W('Handguns', 'UPP MP-4043 Grach Special', '+2', '2', 'Medium', '', '1', '$1,800', 'Armor piercing.', S),

  // ---------- Rifles ----------
  W('Rifles', 'Armat M41A Pulse Rifle', '+2', '2', 'S/L', '3', '1', '$1,200', 'Armor piercing, full auto, grenade launcher (U1).'),
  W('Rifles', 'F44AA Pulse Rifle', '+3', '2', 'S/L', '3', '1', '$1,500', 'Armor piercing, full auto, unreliable (Mess Up bei einer Stress Response verursacht zusätzlich eine Ladehemmung).'),
  W('Rifles', 'AK-4047 Pulse Assault Rifle', '+1', '2', 'S/L', '2', '1', '$600', 'Armor piercing, full auto.'),
  W('Rifles', 'M42A Scope Rifle', '+3', '2', 'M/E', '2', '1', '$1,000', 'Armor piercing.'),
  W('Rifles', 'Armat M41AE2 Heavy Pulse Rifle', '+2', '2', 'M/E', '4', '2', '$1,500', 'Armor piercing, full auto.'),
  W('Rifles', 'Armat Model 37A2 12 Gauge Pump Action', '+2', '3', 'A/S', '1', '1', '$500'),
  W('Rifles', 'Armat XM99A Phased Plasma Pulse Rifle', '', '4', 'M/E', '1', '2', '$20,000', 'Armor piercing, aim required (vor dem Schuss Quick Action zielen, +2 Dice wie üblich).'),
  W('Rifles', 'Spacesub ASSO-400 Harpoon Gun', '', '1', 'S/M', 'Single-shot', '1', '$300', 'Harpoon effect: Haken hängt am Ziel. In Zero-G zum schwereren Ziel ziehen (Full Action, bis Adjacent) oder leichteres heranziehen (Strength-Wurf, wenn es sich wehrt).'),
  W('Rifles', 'Armat P9 S.H.A.R.P. Rifle', '', 'Blast Power 9', 'Long', '', '2', '$15,000', 'Detoniert nach einer Round oder wenn sich ein Gegner in der Zone bewegt.', S),
  W('Rifles', 'Norcomm AK-104S Pulse Action Suit Gun', '', '2', 'Long', '', '–', '–', 'Armor piercing, full auto. Teil des CCC5 Combat Compression Suit.', S),
  W('Rifles', 'RMC F903WE Automatic Assault Rifle', '+1', '2', 'Long', '', '2', '$500', 'Full auto.', S),
  W('Rifles', 'Weyland-Yutani NSG23 Automatic Assault Rifle', '+2', '2', 'Long', '', '1', '$1,500', 'Armor piercing, full auto, ID23 Incinerator Unit inklusive.', S),
  W('Rifles', 'ID23 Underbarrel Incinerator Unit', '', '2', 'Medium', '', '–', '$700', 'Fire intensity 7. Teil des NSG23.', S),
  W('Rifles', 'Weyland ES-7 Supernova Dual-Action Electrostatic Shockgun', '+2', '2', 'Short', '', '1', '$1,200', 'Stun effect, armor piercing. Getroffene Menschen: harter Stamina-Wurf (−2, keine Aktion) oder eine Round stunned. Ungereinigt: bei zwei oder mehr 1ern auf Stress Dice wird auch der Schütze gestunnt.', S),
  W('Rifles', 'Weyland Storm Rifle', '+1', '2', 'Extreme', '', '2', '$3,000', 'Armor piercing, full auto. Unterlauf-Schrotflinte. Scharfschützenfunktion bis 5 km.', S),

  // ---------- Heavy Weapons ----------
  W('Heavy Weapons', 'M56 Smartgun', '+3', '3', 'S/L', '3', '3', '$6,000', 'Armor piercing, full auto, smart sight (nach Zielen im Full-Auto-Modus bekommen auch 2. und 3. Salve den Aim-Bonus).'),
  W('Heavy Weapons', 'M240 Incinerator Unit', '+1', '2 (fire)', 'S/S', '2', '1', '$500', 'Fire effect: getroffenes Ziel brennt mit Intensity 9 weiter. Alternativ eine Zone mit Intensity 9 entzünden (ein Erfolg nötig).'),
  W('Heavy Weapons', 'M5A3 RPG Launcher', '−1', '7', 'M/E', 'Single-shot', '2', '$1,800', 'Armor piercing, aim required.'),
  W('Heavy Weapons', 'UA 571-C Sentry Gun', '', '4', 'S/L', '5', '–', '$12,000', 'Armor piercing, full auto, automation: feuert auf das nächste Ziel mit Ranged Combat 8 (ohne Agility), kein Push. Fernsteuerbar per Head Mounted Sight.'),
  W('Heavy Weapons', 'Armat U1 Grenade Launcher', '+1', '2E', 'M/L', '1', '½', '$600', 'Wirkung hängt vom Granatentyp ab (Smoke: kein Schaden, blockiert die Sicht in der Zielzone; G2: Stun).'),
  W('Heavy Weapons', 'Armat U4A2 Repeating Grenade Launcher', '+2', 'Varies', 'Long', '', '2', '$1,100', 'Kann verschiedene Granatentypen verschießen.', S),
  W('Heavy Weapons', 'Norcomm RPG122', '', '5', 'Extreme', 'Single-shot', '2', '$1,700', 'Armor piercing.', S),
  W('Heavy Weapons', 'Weyland 72A Light Energy Weapon', '+1', '6', 'Extreme', '', '3', '$10,500', 'Armor piercing, Damage −1 je Range Band über Short.', S),
  W('Heavy Weapons', 'M78 PIG Phased-Plasma Infantry Gun', '', '6', 'Extreme', '', '3', '$9,000', 'Armor piercing, Damage −1 je Range Band über Short.', S),
  W('Heavy Weapons', 'UA-102-20 Independently Targeting Particle Beam Phalanx', '+2', '4/7', 'Long/Extreme', '', '–', '$25,000', 'Armor piercing, full auto oder fokussierter Angriff mit mehr Damage und Range.', S),
  W('Heavy Weapons', 'Rexim RXF-M4 EVA Mining Laser', '−2', '3', 'Short', 'Power 5', '2', '$400', 'Armor piercing.', S),
  W('Heavy Weapons', 'Weyland Flammenmacher 3 Heavy Incinerator Unit', '+1', '3', 'Long', '', '2', '$2,000', 'Fire intensity 12.', S),

  // ---------- Grenades & Explosives ----------
  W('Grenades & Explosives', 'M40 HEDP Grenade', '', '2E', 'S/M', 'Single use', '¼', '$60', 'Für den U1 oder als Handgranate.'),
  W('Grenades & Explosives', 'G2 Electroshock Grenade', '', '2E (stun)', 'S/M', 'Single use', '¼', '$400', 'Werte gelten als Handgranate.'),
  W('Grenades & Explosives', 'Seismic Survey Charge', '', '3E', 'S/M', 'Single use', '1', '$200'),

  // ---------- Close Combat Weapons ----------
  W('Close Combat Weapons', 'Combat Knife', '+1', '2', 'A/A', '', '½', '$50', '', 'Evolved', { skill: 'closeCombat' }),
  W('Close Combat Weapons', 'Fire Axe', '', '2', 'A/A', '', '1', '$60', 'Armor piercing.', 'Evolved', { skill: 'closeCombat' }),
  W('Close Combat Weapons', 'Stun Baton', '+1', '1 (stun)', 'A/A', 'Power 2', '1', '$80', '', 'Evolved', { skill: 'closeCombat' }),
  W('Close Combat Weapons', 'Cutting Torch', '−1', '3', 'A/A', 'Power 3', '1', '$300', 'Armor piercing.', 'Evolved', { skill: 'closeCombat' }),

  // ---------- Suits & Armor ----------
  A('Suits & Armor', 'M3 Personnel Armor', '2', '–', '1', '$1,200', 'Comm unit, PDT.'),
  A('Suits & Armor', 'Kevlar Riot Vest', '1', '–', '½', '$600'),
  A('Suits & Armor', 'IRC Mk.50 Compression Suit', '–', '5', '1', '$4,000', 'Vacuum protection, comm unit, head light, −1 auf Mobility.'),
  A('Suits & Armor', 'IRC Mk.35 Pressure Suit', '1', '4', '2', '$2,000', 'Vacuum protection, −2 auf Mobility.'),
  A('Suits & Armor', 'Eco All-World Survival Suit', '2', '6', '2', '$30,000', 'Vacuum protection, comm unit, head light, +2 Mobility bei Bewegung in Zero-G.'),
  A('Suits & Armor', 'Weyland-Yutani APEsuit', '1', '4', '1', '$5,000', 'Armor Level 3 gegen Säure, schützt vor Facehuggern, Survival +2.'),
  A('Suits & Armor', 'P-5000 Powered Work Loader', '1', '–', '–', '$50,000', 'Erfordert Heavy Machinery 2+. +3 Dice auf Heavy Machinery und Close Combat, Base Damage 3 im Nahkampf.'),
  A('Suits & Armor', 'M10 Ballistic Helmet', '–', '–', '0', '–', 'Eingebaute taktische Kamera. Teil der M3 Personnel Armor.', S),
  A('Suits & Armor', 'Armat CM4 Plastisteel Riot Shield', '5', '–', '1', '$300', 'Gibt Deckung nach einer Slow Action.', S),
  A('Suits & Armor', '6B90 Combat Armor', '6', '–', '2', '$1,000', 'Comm unit und taktische Kamera.', S),
  A('Suits & Armor', 'CCC5 Combat Compression Suit', '2', '5', '2', '$15,500', 'Observation −1, AK-104 angebaut.', S),
  A('Suits & Armor', 'CCC4 Cosmos Corps Compression Suit', '1', '5', '1', '$5,000', 'Observation −1.', S),
  A('Suits & Armor', 'Military Grade HAZMAT Suit', '1', '2', '2', '$1,000', 'Comm unit. Schützt vor chemischen und biologischen Kontaminanten und Strahlung.', S),
  A('Suits & Armor', 'Professional Hazmat Suit', '1', '3', '2', '$1,000', 'Comm unit. Schützt vor chemischen und biologischen Kontaminanten und Strahlung.', S),
  A('Suits & Armor', 'Biohazard Suit', '1', '2', '1', '$600', 'Comm unit. Schützt vor chemischen und biologischen Kontaminanten.', S),
  A('Suits & Armor', 'Presidium Mark VIII Advanced SE Suit', '2/3', '3', '1', '$800', 'Armor 2, mit Iridium-Weste 3. Comm unit. Exoskelett: +1 auf Strength-Würfe. Eingebaute Schulterlampe.', S),
  A('Suits & Armor', 'ECO2 All World Systems High Pressure Survival Suit', '8', '6', '3', '$20,000', 'Comm unit, verstärkte Hülle, für Hochdruck-Umgebungen.', S),
  A('Suits & Armor', 'YAWS3 Yutani All Weather Singular Survival Shelter', '2', '12', '¾', '$30,000', 'Motion Detector, PDT, Rebreather, Medkit, Sedativa/Stimulanzien, 1 Woche Verbrauchsgüter. Power Supply 6. Aktiviert Weight 4. Schützt vor Vakuum.', S),
  A('Suits & Armor', 'Omni-Tech EL7-HXC Emergency Landing Hex Capsule', '10', '–', '3', '$150,000', 'Schützt nur vor kinetischem Schaden, Feuer und Strahlung.', S),

  // ---------- Protective Gear ----------
  G('Protective Gear', 'Life Vest', '1', '$65', 'Verhindert Ertrinken an der Wasseroberfläche.', S),
  G('Protective Gear', 'Cold Weather Parka', '¼', '$100', 'Stamina +2 gegen Kälte.', S),
  G('Protective Gear', 'UDEP Ultra Diffusive Environmental Poncho', '1', '$500', 'Stamina +2 gegen chemische und biologische Kontaminanten, Stealth +2 in nasser Umgebung.', S),
  G('Protective Gear', 'G-Suit', '1', '$120', 'Air Supply 1.', S, { air: '1' }),
  G('Protective Gear', 'Full Face Personal Rebreather Mask', '½', '$100', 'Schützt vor gasförmigen und luftgetragenen Kontaminanten. Atmen unter Wasser.', S, { air: '2' }),

  // ---------- Fatigues ----------
  G('Fatigues', 'Expedition Fatigues', '–', '$55', 'Stamina +1 gegen Hitze, Kälte und Vakuum.', S),
  G('Fatigues', 'M7A Dry Boots', '–', '$60', 'Verhindert Fußfäule in feuchter Umgebung.', S),
  G('Fatigues', 'M8A2 Thermal Boots', '–', '$75', 'Stamina +1 gegen Kälte.', S),
  G('Fatigues', 'M11 Performance Enhanced Platypus Fins', '½', '$100', '+2 auf Mobility unter Wasser.', S),

  // ---------- Tools ----------
  G('Tools', 'Watatsumi DV-303 Bolt Gun (Tool)', '1', '$400', 'Schiffsreparaturen (Heavy Machinery +2). Auch als Waffe nutzbar.'),
  G('Tools', 'Maintenance Jack', '1', '$150', 'Heavy Machinery +1 in passenden Situationen. Als Waffe: Bonus +1, Base Damage 1.'),
  G('Tools', 'Mechanical Cutting Torch', '1', '$300', 'Bau und Reparaturen (Heavy Machinery +2). Auch als Waffe nutzbar.', 'Evolved', { power: '3' }),
  G('Tools', 'Power Cell', '¼', '$30', 'Füllt die Power Supply eines Gegenstands komplett auf.'),
  G('Tools', 'Electronic Tools', '½', '$250', 'Comtech +1 in passenden Situationen.'),
  G('Tools', 'Mining Tool Kit', '2', '$300', 'Heavy Machinery +2 beim Bergbau.', S),
  G('Tools', 'Folding Entrenching Spade', '½', '$30', 'Als Nahkampfwaffe nutzbar (Bonus +1, Base Damage 2).', S),
  G('Tools', 'Folding Winch', '1', '$40', 'Mit Seil: kein Mobility-Wurf beim Klettern nötig.', S),
  G('Tools', 'Polymer Climbing Rope', '½', '$40', '45 m Seil mit abriebfester Beschichtung.', S),

  // ---------- Medical Supplies ----------
  G('Medical Supplies', 'Personal Medkit', '¼', '$50', 'Medical Aid +2 für Erste Hilfe (einmalig).'),
  G('Medical Supplies', 'Surgical Kit', '1', '$200', 'Medical Aid +2 für Erste Hilfe und Operationen bei Critical Injuries. Als Waffe Base Damage 2.'),
  G('Medical Supplies', 'AutoDoc', 'N/A', '$500,000', 'Erste Hilfe (keine Operationen) mit Medical Aid 8, kein Push.'),
  G('Medical Supplies', 'Pauling MedPod', 'N/A', '$2,000,000', 'Erste Hilfe und Operationen mit Medical Aid 12, kein Push.'),
  G('Medical Supplies', 'CBRN Detection Kit', '1', '$800', 'Erkennt Strahlung, +2 auf Sickness Rolls.', S),

  // ---------- Vision Devices ----------
  G('Vision Devices', 'Flashlight', '½', '$40', 'Hebt die Wirkung von Dunkelheit in einer Zone auf.', 'Evolved', { range: 'Short' }),
  G('Vision Devices', 'Optical Scope', '–', '$60', 'Erhöht die Range einer Pistole oder eines Gewehrs um eine Stufe, nur bei gezielten Schüssen.', 'Evolved', { range: '+1' }),
  G('Vision Devices', 'Binoculars', '½', '$100', 'Observation +2 ab Long Range.', 'Evolved', { range: 'Extreme' }),
  G('Vision Devices', 'M314 Motion Tracker', '1', '$1,200', 'Erkennt Bewegung im Stealth Mode.', 'Evolved', { range: 'Long', power: '5' }),
  G('Vision Devices', 'M316 Motion Tracker', '–', '$3,000', 'Erkennt Bewegung im Stealth Mode.', 'Evolved', { range: 'Medium', power: '3' }),
  G('Vision Devices', 'Neuro Visor', '1', '$10,000', 'Hypersleep-Patienten überwachen oder mit ihnen interagieren (Comtech-Wurf).', 'Evolved', { range: 'Long', power: '5' }),
  G('Vision Devices', 'Seegson Microview-2000SE', '½', '$250', 'Zeigt den aktuellen Standort.', 'Evolved', { range: 'Extreme' }),
  G('Vision Devices', 'Parameter Uplink Spectrograph Mapping Device', '1', '$50,000', 'Scannt eine Zone pro Stretch im Stealth Mode, erkennt automatisch Gegner, die nicht versteckt sind.', 'Evolved', { range: 'Extreme', power: '5' }),
  G('Vision Devices', 'TNR High Beam Shoulder Lamp', '½', '$60', 'Hebt die Wirkung von Dunkelheit in einer Zone auf.', S),
  G('Vision Devices', 'F3S Full Spectrum Spotter Scope', '½', '$200', 'Bonus auf koordinierte Scharfschützen-Angriffe.', S),
  G('Vision Devices', 'LAG Laser Attunement Guide', '¼', '$200', 'Blendlicht (−1 Observation für alle in einer Zone um das Ziel) oder panzerbrechend (+1 Damage, erfordert Power Supply Roll).', S),

  // ---------- Diagnostics & Display ----------
  G('Diagnostics & Display', 'Computer Terminal', 'N/A', 'Varies', 'Daten abrufen und verarbeiten (Comtech-Wurf).'),
  G('Diagnostics & Display', 'Samani E-Series Watch', '–', '$50', 'Zeigt Zeit, Sauerstoff und Druck (Survival +1).'),
  G('Diagnostics & Display', 'Personal Data Transmitter', '–', '$100', 'Überwacht Standort und Vitalwerte (Medical Aid +1).'),
  G('Diagnostics & Display', 'IFF Transponder', '–', '$250', 'Verhindert Friendly Fire durch Sentry Guns.'),
  G('Diagnostics & Display', 'Data Transmitter Cards', '–', '$50', 'Übertragung audiovisueller Daten (Comtech +1).'),
  G('Diagnostics & Display', 'HoloTab', 'N/A', '$100,000', 'Strategische Analyseplattform (Observation und Command +2).'),
  G('Diagnostics & Display', 'Seegson P-DAT', '½', '$500', 'Koordiniert Infos für Einsatzteams (Command +1).'),
  G('Diagnostics & Display', 'Seegson System Diagnostic Device', '1', '$300', 'Fehlersuche in Computersystemen (Comtech +2).'),
  G('Diagnostics & Display', 'Modular Computing Device', 'N/A', '$8,000', 'Audiovisueller Holoprojektor (Manipulation +2).'),
  G('Diagnostics & Display', 'PR-PUT Uplink Terminal', '1', '$9,000', 'Fernsteuerung von Raumschiffen (Comtech-Wurf).'),
  G('Diagnostics & Display', 'Comm Unit', '–', '$50', 'Funkverbindung im Team, ca. 1 km Reichweite.'),
  G('Diagnostics & Display', 'Seegson C-Series Magnetic Tape Recorder', '1', '$80', 'Musik aufnehmen und abspielen (Manipulation +1).'),
  G('Diagnostics & Display', 'PDT/L Bracelet/Locator Tube Set', '¼', '$100', 'Ortungsarmband mit Peilröhren.', S),

  // ---------- Data Storage ----------
  G('Data Storage', 'Long-Data Discs', '–', '$5,000', 'Speichert bis zu 10 Zettabyte.'),
  G('Data Storage', 'Magnetic Tape', '–', '$5', 'Speichert bis zu 120 Terabyte. Kaum von Sicherheitssensoren erkennbar.'),

  // ---------- Food & Drink ----------
  G('Food & Drink', 'Prefab Meals', '¼', '$10', 'Deckt den Nahrungsbedarf für einen Tag.'),
  G('Food & Drink', 'Candy Bar', '¼', '$15', 'Deckt den Nahrungsbedarf für einen Tag.'),
  G('Food & Drink', 'Water Bottle', '¼', '$2–$100', 'Deckt den Wasserbedarf für einen Tag.'),
  G('Food & Drink', '"Bug Juice" Protein Drink', '¼', '$5', 'Deckt Nahrungs- und Wasserbedarf für einen Tag.'),
  G('Food & Drink', 'Coffee', '–', 'Free–$1.50', 'Stress Level +1, verschiebt Fatigue durch Schlafmangel um einen Shift. Weitere Dosen im selben Shift wirkungslos.'),
  G('Food & Drink', 'Colony Specialty Meals', '¼', '$20–$300', 'Deckt den Nahrungsbedarf für einen Tag, Stress Level −1.'),
  G('Food & Drink', 'Beer and Booze', '¼', '$5–$500', 'Stress Level −1. Jede weitere Dosis im selben Shift: −1 Die auf alle Skill-Würfe bis Shift-Ende.'),
  G('Food & Drink', 'Recreational Drugs', '–', 'Varies', 'Meist Stress Level +1 oder −1. Jede weitere Dosis im selben Shift: −1 Die auf alle Skill-Würfe bis Shift-Ende.'),
  G('Food & Drink', 'X-Drugs', '–', 'Varies', 'Unterschiedlich; steigern Kraft, Ausdauer, Sinne, mit schweren Nebenwirkungen.'),

  // ---------- Pharmaceuticals (Tiny Items, Preis pro Dosis) ----------
  G('Pharmaceuticals', 'Neversleep Pills', '–', '$2', 'Stress Level +1, kein Schlaf nötig für einen Tag; in der Zeit kein Stress abbauen. Tiny Item.'),
  G('Pharmaceuticals', 'Hydr8tion', '–', '$5', 'Beseitigt Fatigue durch Hypersleep. Tiny Item.'),
  G('Pharmaceuticals', 'Naproleve', '–', '$20', 'Setzt Stress Level auf 0. Jede weitere Dosis im selben Shift: −1 Die auf alle Skill-Würfe bis Shift-Ende. Tiny Item.'),

  // ---------- Other Equipment ----------
  G('Other Equipment', 'BiMex Personal Shades', '0', '$150', 'Kann Laser ablenken.', S),
  G('Other Equipment', 'Individual Marine Pack', '0', '$100', 'Erhöht die Tragkapazität um 2.', S),
  G('Other Equipment', 'Heavy Safari Pack', '0', '$100', 'Erhöht die Tragkapazität um 2.', S),
  G('Other Equipment', 'Muzzle Suppressor', '¼', '$50–$200', 'Gegner müssen Observation würfeln, um den Schuss zu bemerken.', S),
  G('Other Equipment', 'M73PX Parafoil', '3', '$1,250', 'Speed 3, Piloting zum Steuern.', S),
  G('Other Equipment', 'Omni-Tech SDDG Sonic Deterrent Defense Grid', '4 per fence', '$50,000', 'Jede Round in 1 Zone um den Zaun Stamina-Wurf, sonst Stress +1 und Panic Roll. $10,000 pro Zusatzzaun.', S),
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const CATALOG = ITEMS.map((it) => ({ id: slug(`${it.cat}-${it.name}`), ...it }));
