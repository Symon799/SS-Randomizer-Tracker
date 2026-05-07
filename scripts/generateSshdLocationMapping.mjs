import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const [sshdLocationsPath = '.tmp_sshd_apworld/Locations.py'] =
    process.argv.slice(2);

const trackerDumpPath = 'testData/dump.yaml';
const trustedMappingJsonPath =
    'src/archipelago/sshdTrustedLocationMapping.json';
const mappingDocPath = 'docs/sshd-location-mapping.md';

const autoMapMinScore = 0.88;
const autoMapMinGap = 0.08;
const suggestionMinScore = 0.52;

const manualMappings = {
    "Knight Academy - Fledge's Gift": [
        "Upper Skyloft - Fledge's Gift",
        'HD split Knight Academy out of Upper Skyloft.',
    ],
    'Knight Academy - Item from Cawlin': [
        'Upper Skyloft - Item from Cawlin',
        'HD split Knight Academy out of Upper Skyloft.',
    ],
    "Knight Academy - Zelda's Closet": [
        "Upper Skyloft - In Zelda's Closet",
        'Same closet check with HD wording.',
    ],
    "Knight Academy - Crystal in Zelda's Room": [
        "Upper Skyloft - Crystal in Zelda's Room",
        'HD split Knight Academy out of Upper Skyloft.',
    ],
    "Knight Academy - Crystal in Link's Room": [
        "Upper Skyloft - Crystal in Link's Room",
        'HD split Knight Academy out of Upper Skyloft.',
    ],
    'Knight Academy - Crystal in Knight Academy Plant': [
        'Upper Skyloft - Crystal in Knight Academy Plant',
        'HD split Knight Academy out of Upper Skyloft.',
    ],
    'Sparring Hall - Chest in Back Room': [
        'Upper Skyloft - Sparring Hall Chest',
        'Same Sparring Hall chest; HD uses the room description.',
    ],
    'Sparring Hall - Crystal on Roof Beam': [
        'Upper Skyloft - Crystal in Sparring Hall',
        'Same loose gratitude crystal in Sparring Hall.',
    ],
    'Inside the Statue of the Goddess - Raise Sword Item 1': [
        'Upper Skyloft - First Goddess Sword Item in Goddess Statue',
        'Same first Goddess Statue story item.',
    ],
    'Inside the Statue of the Goddess - Raise Sword Item 2': [
        'Upper Skyloft - Second Goddess Sword Item in Goddess Statue',
        'Same second Goddess Statue story item.',
    ],
    "Bazaar - Luv the Potion Lady's Gift": [
        "Central Skyloft - Potion Lady's Gift",
        'Same potion lady bottle gift.',
    ],
    "Bazaar - Repair Gondo's Junk": [
        "Central Skyloft - Repair Gondo's Junk",
        'Same Scrapper repair check.',
    ],
    'Bazaar - Goddess Chest': [
        'Central Skyloft - Bazaar Goddess Chest',
        'Same Bazaar goddess chest.',
    ],
    'Lumpy Pumpkin - Harp Duet with Kina': [
        'Sky - Lumpy Pumpkin - Harp Minigame',
        'Same Lumpy Pumpkin harp minigame reward.',
    ],
    "Fun Fun Island - 500 Rupees in Dodoh's High Dive": [
        'Sky - Fun Fun Island Minigame -- 500 Rupees',
        'Same Fun Fun Island minigame reward.',
    ],
    'Sealed Temple - Chest near The Old One': [
        'Sealed Grounds - Chest inside Sealed Temple',
        'Same chest inside Sealed Temple.',
    ],
    "Temple of Hylia - Zelda's Blessing": [
        "Sealed Grounds - Zelda's Blessing",
        'Same late-game Zelda blessing reward.',
    ],
};

function parsePythonStringList(value) {
    const result = [];
    const stringRegex = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
    for (const match of value.matchAll(stringRegex)) {
        result.push((match[1] ?? match[2]).replace(/\\'/g, "'"));
    }
    return result;
}

function parseSshdLocations(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(
            `SSHD Locations.py not found at ${filePath}. Clone https://github.com/LonLon-Labs/SSHD_APWorld.git to .tmp_sshd_apworld or pass the path to Locations.py as the first argument.`,
        );
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const locationRegex =
        /^    "((?:\\"|[^"])*)": SSHDLocation\("((?:\\"|[^"])*)", (\d+), "((?:\\"|[^"])*)", "((?:\\"|[^"])*)", (.+)\),$/gm;
    const locations = [];

    for (const match of text.matchAll(locationRegex)) {
        locations.push({
            hdName: match[1],
            hdCode: Number(match[3]),
            hdRegion: match[4],
            hdOriginalItem: match[5],
            hdTypes: parsePythonStringList(match[6]),
        });
    }

    if (locations.length === 0) {
        throw new Error(`No SSHD locations found in ${filePath}`);
    }

    return locations;
}

function parseTrackerChecks(filePath) {
    const dump = yaml.load(fs.readFileSync(filePath, 'utf8'));
    return Object.entries(dump.checks).map(([trackerCheckId, check]) => ({
        trackerCheckId,
        trackerName: check.short_name,
        trackerOriginalItem: check['original item'],
        trackerType: check.type,
    }));
}

function normalizeText(value) {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/'s\b/g, 's')
        .replace(/\bbeedle s airshop\b/g, 'beedles shop')
        .replace(/\bairshop\b/g, 'shop')
        .replace(/\bgoddess chest\b/g, 'chest goddess')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(
            /\b(the|a|an|in|on|at|near|of|to|from|with|and|above|below|behind|inside|outside)\b/g,
            ' ',
        )
        .replace(/\bgratitude\b/g, '')
        .replace(/\bcrystals\b/g, 'crystal')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenSet(value) {
    return new Set(normalizeText(value).split(' ').filter(Boolean));
}

function jaccard(left, right) {
    const leftTokens = tokenSet(left);
    const rightTokens = tokenSet(right);
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) {
            intersection++;
        }
    }
    const union = leftTokens.size + rightTokens.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

function normalizeItem(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/^progressive /, '')
        .replace(/^empty /, '')
        .replace(/baby'?s rattle/, 'rattle')
        .replace(/song of the hero part/, 'song of the hero')
        .replace(/#\d+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isGenericItem(value) {
    return /rupee|heart$|stamina fruit|gratitude crystal$|fairy|deku seeds/.test(
        normalizeItem(value),
    );
}

function locationScore(hdLocation, trackerCheck) {
    let score = jaccard(hdLocation.hdName, trackerCheck.trackerName);
    const hdItem = normalizeItem(hdLocation.hdOriginalItem);
    const trackerItem = normalizeItem(trackerCheck.trackerOriginalItem);

    if (hdItem && trackerItem && hdItem === trackerItem) {
        score += isGenericItem(hdItem) ? 0.05 : 0.17;
    }

    if (trackerCheck.trackerName.includes(hdLocation.hdRegion)) {
        score += 0.04;
    }

    return score;
}

function shouldSkipAutoMapping(hdLocation) {
    return hdLocation.hdTypes.some((type) =>
        [
            'Closets',
            'Hidden Items',
            'Stamina Fruits',
            'Gossip Stone Treasures',
            'Goddess Cubes',
        ].includes(type),
    );
}

function findBestCandidate(hdLocation, trackerChecks) {
    return trackerChecks
        .map((trackerCheck) => ({
            ...trackerCheck,
            score: locationScore(hdLocation, trackerCheck),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 2);
}

function buildMapping(hdLocations, trackerChecks) {
    const trackerByName = new Map(
        trackerChecks.map((check) => [check.trackerName, check]),
    );

    return hdLocations.map((hdLocation) => {
        const exactTrackerCheck = trackerByName.get(hdLocation.hdName);
        if (exactTrackerCheck) {
            return {
                ...hdLocation,
                mapping: 'exact',
                trackerCheckId: exactTrackerCheck.trackerCheckId,
                trackerName: exactTrackerCheck.trackerName,
                notes: 'Exact AP name match with the current tracker.',
            };
        }

        const manualMapping = manualMappings[hdLocation.hdName];
        if (manualMapping) {
            const [trackerName, notes] = manualMapping;
            const trackerCheck = trackerByName.get(trackerName);
            if (!trackerCheck) {
                throw new Error(
                    `Manual mapping for "${hdLocation.hdName}" points to missing tracker check "${trackerName}"`,
                );
            }
            return {
                ...hdLocation,
                mapping: 'manual',
                trackerCheckId: trackerCheck.trackerCheckId,
                trackerName: trackerCheck.trackerName,
                notes,
            };
        }

        const [bestCandidate, secondCandidate] = findBestCandidate(
            hdLocation,
            trackerChecks,
        );
        const scoreGap = bestCandidate.score - (secondCandidate?.score ?? 0);
        const canAutoMap =
            !shouldSkipAutoMapping(hdLocation) &&
            bestCandidate.score >= autoMapMinScore &&
            scoreGap >= autoMapMinGap;

        if (canAutoMap) {
            return {
                ...hdLocation,
                mapping: 'auto-high',
                trackerCheckId: bestCandidate.trackerCheckId,
                trackerName: bestCandidate.trackerName,
                score: Number(bestCandidate.score.toFixed(3)),
                notes: 'Generated by name/item similarity; reviewable in docs.',
            };
        }

        return {
            ...hdLocation,
            mapping: 'unmapped',
            trackerCheckId: null,
            trackerName: null,
            suggestedTrackerCheckId:
                bestCandidate.score >= suggestionMinScore
                    ? bestCandidate.trackerCheckId
                    : null,
            suggestedTrackerName:
                bestCandidate.score >= suggestionMinScore
                    ? bestCandidate.trackerName
                    : null,
            suggestedScore:
                bestCandidate.score >= suggestionMinScore
                    ? Number(bestCandidate.score.toFixed(3))
                    : null,
            notes: 'No trusted mapping yet.',
        };
    });
}

function escapeMarkdownCell(value) {
    return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, ' ');
}

function writeReviewDoc(mapping) {
    const counts = Object.entries(
        mapping.reduce((acc, entry) => {
            acc[entry.mapping] = (acc[entry.mapping] ?? 0) + 1;
            return acc;
        }, {}),
    )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, count]) => `- ${key}: ${count}`)
        .join('\n');

    const rows = mapping
        .map((entry) =>
            [
                entry.hdName,
                entry.hdRegion,
                entry.hdOriginalItem,
                entry.hdTypes.join(', '),
                entry.mapping,
                entry.trackerName,
                entry.trackerCheckId,
                entry.suggestedTrackerName,
                entry.suggestedScore,
                entry.notes,
            ]
                .map(escapeMarkdownCell)
                .join(' | '),
        )
        .join('\n');

    const doc = `# SSHD Location Mapping

Generated by \`node scripts/generateSshdLocationMapping.mjs\`.

This file lists every known SSHD Archipelago location and the current best mapping to an existing Wii tracker check.

Only rows with \`exact\`, \`manual\`, or \`auto-high\` are used by the web tracker. Rows marked \`unmapped\` are intentionally ignored until reviewed.

The complete review table is kept here. The web app imports the compact trusted subset from \`${trustedMappingJsonPath}\`.

## Summary

- total SSHD locations: ${mapping.length}
${counts}

## Locations

HD location | HD region | HD original item | HD types | mapping | tracker check | tracker check id | suggested tracker check | suggested score | notes
--- | --- | --- | --- | --- | --- | --- | --- | --- | ---
${rows}
`;

    fs.mkdirSync(path.dirname(mappingDocPath), { recursive: true });
    fs.writeFileSync(mappingDocPath, doc);
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function toTrustedMapping(mapping) {
    return mapping
        .filter((entry) => entry.trackerCheckId !== null)
        .map((entry) => ({
            hdName: entry.hdName,
            trackerCheckId: entry.trackerCheckId,
            trackerName: entry.trackerName,
            mapping: entry.mapping,
        }));
}

const hdLocations = parseSshdLocations(sshdLocationsPath);
const trackerChecks = parseTrackerChecks(trackerDumpPath);
const mapping = buildMapping(hdLocations, trackerChecks).sort(
    (left, right) => left.hdCode - right.hdCode,
);
const trustedMapping = toTrustedMapping(mapping);

writeJson(fullMappingJsonPath, mapping);
writeJson(trustedMappingJsonPath, trustedMapping);
writeReviewDoc(mapping);

const mappedCount = trustedMapping.length;
console.log(
    `Generated ${trustedMappingJsonPath} and ${mappingDocPath}: ${mappedCount}/${mapping.length} trusted mappings.`,
);
