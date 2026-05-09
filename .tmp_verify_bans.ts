import yaml from 'js-yaml';
import fs from 'node:fs';
import { parseLogic } from './src/logic/Logic.ts';
import { validateSettings } from './src/permalink/Settings.ts';
import { lightColorScheme } from './src/customization/ColorScheme.ts';
import { isCheckBannedSelector } from './src/tracker/Selectors.ts';
const raw = yaml.load(fs.readFileSync('testData/sshd-dump.yaml','utf8'));
const options = yaml.load(fs.readFileSync('testData/sshd-options.yaml','utf8'));
const logic = parseLogic(raw);
const settings = validateSettings(options, {});
const state = {
  customization: { colorScheme: lightColorScheme, itemLayout: 'inventory', locationLayout: 'map', trickSemilogic: false, enabledTrickLogicTricks: [], counterBasis: 'logic', tumbleweed: false, customLayout: undefined, itemLocationAssignment: false, autoRegionLoading: false },
  tracker: { checkedChecks: [], inventory: {}, hasBeenModified: false, mappedExits: {}, requiredDungeons: [], hints: {}, checkHints: {}, settings, userHintsText: '', lastCheckedLocation: undefined },
  logic: { loaded: { logic: raw, options, presets: {}, remote: { type: 'localSshd' }, remoteName: 'test' } },
  saves: { presets: [] },
};
const isBanned = isCheckBannedSelector(state);
const checks = [
  '\\Skyloft\\Upper Skyloft\\Upper Skyloft - Stamina Fruit near Sparring Hall',
  "\\Skyloft\\Knight Academy\\Knight Academy - Bonk Classroom Bookshelf"
];
for (const id of checks) {
  console.log(id, logic.checks[id]?.type, isBanned(id));
}
console.log('settings', settings['stamina-fruit-shuffle'], settings['hidden-item-shuffle']);
