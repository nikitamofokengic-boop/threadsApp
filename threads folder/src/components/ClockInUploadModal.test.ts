import test from 'node:test';
import assert from 'node:assert/strict';

import { matchesImportHeaderLabel } from './ClockInUploadModal';
import { extractAndNormalizeDate, isValidDateSheetName } from '../utils/payCycle';

test('matches the standard Cadre / Present / Absent / Cost labels used by clock-in imports', () => {
  assert.equal(matchesImportHeaderLabel('Cadre', ['cadre', 'total employees headcount']), true);
  assert.equal(matchesImportHeaderLabel('Total employees headcount', ['cadre', 'total employees headcount']), true);
  assert.equal(matchesImportHeaderLabel('Employees at work today', ['present', 'employees at work today']), true);
  assert.equal(matchesImportHeaderLabel('Employees not at work', ['absent', 'employees not at work']), true);
  assert.equal(matchesImportHeaderLabel('Wage amount for present staff', ['cost', 'wage amount for present staff']), true);
  assert.equal(matchesImportHeaderLabel('Department/Role', ['department']), true);
});

test('recognizes dotted numeric worksheet dates and preserves the sheet date', () => {
  assert.equal(isValidDateSheetName('07.09.2026'), true);
  assert.equal(extractAndNormalizeDate('07.09.2026', '21 JULY 2026'), '7 SEPTEMBER 2026');
});
