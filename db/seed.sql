-- seed.sql
-- The starting roster: 8 fictional teams with 2 players each.
-- Runs when the database is first created, and again for "Load sample season".

INSERT INTO teams (id, name, school) VALUES
  (1, 'Northgate Owls',     'Northgate College'),
  (2, 'Riverside Ravens',   'Riverside University'),
  (3, 'Summit Storm',       'Summit State'),
  (4, 'Lakeview Lynx',      'Lakeview College'),
  (5, 'Harbor Hawks',       'Harbor Tech'),
  (6, 'Pinecrest Phantoms', 'Pinecrest University'),
  (7, 'Oakridge Outlaws',   'Oakridge College'),
  (8, 'Bayside Blitz',      'Bayside State');

INSERT INTO players (team_id, slot, epic_name) VALUES
  (1, 1, 'Zyphr'),   (1, 2, 'OwlEyes'),
  (2, 1, 'Corvid'),  (2, 2, 'NightWing22'),
  (3, 1, 'Thundr'),  (3, 2, 'StormChaser'),
  (4, 1, 'PawsUp'),  (4, 2, 'LynxLock'),
  (5, 1, 'Talonz'),  (5, 2, 'SkyDive'),
  (6, 1, 'Ghosted'), (6, 2, 'Specter'),
  (7, 1, 'Bandit'),  (7, 2, 'QuickDraw'),
  (8, 1, 'Rushr'),   (8, 2, 'BoxFight');
