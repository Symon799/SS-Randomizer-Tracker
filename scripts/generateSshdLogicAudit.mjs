import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const [
    sshdRandoRoot = '.tmp_sshd_rando',
    sshdApworldLocationsPath = '.tmp_sshd_apworld/Locations.py',
] = process.argv.slice(2);

const trackerDumpPath = 'testData/dump.yaml';
const goddessCubesPath = 'src/data/goddessCubes2.json';
const trustedMappingJsonPath =
    'src/archipelago/sshdTrustedLocationMapping.json';
const existingMappingDocPath = 'docs/sshd-location-mapping.md';
const auditDocPath = 'docs/sshd-logic-audit.md';

const strongSuggestionMinScore = 0.65;

function requireFile(filePath, description) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${description} not found at ${filePath}`);
    }
}

function parsePythonStringList(value) {
    const result = [];
    const stringRegex = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g;
    for (const match of value.matchAll(stringRegex)) {
        result.push((match[1] ?? match[2]).replace(/\\'/g, "'"));
    }
    return result;
}

function parseApworldLocations(filePath) {
    requireFile(filePath, 'SSHD APWorld Locations.py');

    const text = fs.readFileSync(filePath, 'utf8');
    const locationRegex =
        /^    "((?:\\"|[^"])*)": SSHDLocation\("((?:\\"|[^"])*)", (\d+), "((?:\\"|[^"])*)", "((?:\\"|[^"])*)", (.+)\),$/gm;
    const locations = [];

    for (const match of text.matchAll(locationRegex)) {
        locations.push({
            name: match[1],
            code: Number(match[3]),
            region: match[4],
            originalItem: match[5],
            types: parsePythonStringList(match[6]),
        });
    }

    if (locations.length === 0) {
        throw new Error(`No SSHD APWorld locations found in ${filePath}`);
    }

    return locations;
}

function parseRandoLocations(randoRoot) {
    const locationsPath = path.join(randoRoot, 'data', 'locations.yaml');
    requireFile(locationsPath, 'SSHD rando locations.yaml');

    return new Map(
        yaml.load(fs.readFileSync(locationsPath, 'utf8')).map((location) => [
            location.name,
            {
                name: location.name,
                originalItem: location.original_item,
                types: location.types ?? [],
                isGuiExcludedLocation:
                    location.is_gui_excluded_location ?? true,
            },
        ]),
    );
}

function parseRandoWorldLogic(randoRoot) {
    const worldDir = path.join(randoRoot, 'data', 'world');
    if (!fs.existsSync(worldDir)) {
        throw new Error(
            `SSHD rando world logic directory not found at ${worldDir}`,
        );
    }

    const accessesByLocation = new Map();
    const yamlFiles = fs
        .readdirSync(worldDir)
        .filter((fileName) => fileName.endsWith('.yaml'))
        .sort();

    for (const fileName of yamlFiles) {
        const filePath = path.join(worldDir, fileName);
        const areas = yaml.load(fs.readFileSync(filePath, 'utf8'));
        for (const area of areas) {
            for (const [locationName, requirement] of Object.entries(
                area.locations ?? {},
            )) {
                const accesses = accessesByLocation.get(locationName) ?? [];
                accesses.push({
                    fileName,
                    area: area.name,
                    hintRegion:
                        area.hint_region ?? area.hard_assigned_region ?? '',
                    requirement: String(requirement),
                    allowedTimeOfDay: area.allowed_time_of_day ?? '',
                });
                accessesByLocation.set(locationName, accesses);
            }
        }
    }

    return accessesByLocation;
}

function parseTrackerAreas(randoRoot) {
    const trackerAreasPath = path.join(randoRoot, 'data', 'tracker_areas.yaml');
    requireFile(trackerAreasPath, 'SSHD rando tracker_areas.yaml');

    const roots = yaml.load(fs.readFileSync(trackerAreasPath, 'utf8'));
    const nodesByName = new Map(roots.map((node) => [node.name, node]));
    const pathsByName = new Map();

    const visit = (nodeName, ancestry) => {
        const node = nodesByName.get(nodeName);
        if (!node) {
            return;
        }

        const currentPath = [...ancestry, nodeName];
        pathsByName.set(nodeName, currentPath);
        for (const child of node.children ?? []) {
            visit(child, currentPath);
        }
    };

    for (const node of roots) {
        if (!pathsByName.has(node.name)) {
            visit(node.name, []);
        }
    }

    return pathsByName;
}

function parseCurrentTrackerDump(filePath) {
    requireFile(filePath, 'current tracker dump.yaml');

    const dump = yaml.load(fs.readFileSync(filePath, 'utf8'));
    return {
        rawChecks: Object.keys(dump.checks).length,
        gossipStones: Object.keys(dump.gossip_stones ?? {}).length,
    };
}

function parseExistingMappingDoc(filePath) {
    if (!fs.existsSync(filePath)) {
        return new Map();
    }

    const rowsByLocation = new Map();
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        if (
            !line.startsWith('| ') ||
            line.includes('| ---') ||
            line.startsWith('| HD location')
        ) {
            continue;
        }

        const columns = line
            .split('|')
            .slice(1, -1)
            .map((value) => value.trim());
        if (columns.length < 10) {
            continue;
        }

        rowsByLocation.set(columns[0], {
            mapping: columns[4],
            trackerName: columns[5],
            trackerCheckId: columns[6],
            suggestedTrackerName: columns[7],
            suggestedScore: columns[8] === '' ? null : Number(columns[8]),
            notes: columns[9],
        });
    }

    return rowsByLocation;
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function countBy(values, keyFunc) {
    const result = new Map();
    for (const value of values) {
        const key = keyFunc(value);
        result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
}

function mdCell(value) {
    return String(value ?? '')
        .replace(/\r?\n/g, '<br>')
        .replace(/\|/g, '\\|')
        .trim();
}

function mdInlineCode(value) {
    if (!value) {
        return '';
    }
    return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function mdTable(headers, rows) {
    const headerLine = `| ${headers.map(mdCell).join(' | ')} |`;
    const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
    const rowLines = rows.map(
        (row) => `| ${row.map((cell) => mdCell(cell)).join(' | ')} |`,
    );
    return [headerLine, separatorLine, ...rowLines].join('\n');
}

function formatRequirement(accesses) {
    if (accesses.length === 0) {
        return '';
    }

    return accesses
        .map((access) => {
            const requirement = mdInlineCode(access.requirement);
            if (accesses.length === 1) {
                return requirement;
            }
            return `${access.area}: ${requirement}`;
        })
        .join('<br>');
}

function classifyLocation(location) {
    if (!location.randoLocation || location.randoAccesses.length === 0) {
        return 'missing-rando-logic';
    }
    if (location.trustedMapping) {
        return 'trusted-existing-check';
    }
    if (
        location.existingMapping?.suggestedTrackerName &&
        location.existingMapping.suggestedScore >= strongSuggestionMinScore
    ) {
        return 'review-existing-candidate';
    }
    if (location.existingMapping?.suggestedTrackerName) {
        return 'weak-existing-candidate';
    }
    return 'likely-new-check';
}

function actionLabel(action) {
    switch (action) {
        case 'trusted-existing-check':
            return 'already mapped';
        case 'review-existing-candidate':
            return 'review candidate';
        case 'weak-existing-candidate':
            return 'weak candidate';
        case 'likely-new-check':
            return 'add new check';
        case 'missing-rando-logic':
            return 'missing rando logic';
        default:
            return action;
    }
}

function buildAudit() {
    const apworldLocations = parseApworldLocations(sshdApworldLocationsPath);
    const randoLocations = parseRandoLocations(sshdRandoRoot);
    const randoWorldLogic = parseRandoWorldLogic(sshdRandoRoot);
    const trackerPaths = parseTrackerAreas(sshdRandoRoot);
    const trackerDump = parseCurrentTrackerDump(trackerDumpPath);
    const goddessCubes = JSON.parse(fs.readFileSync(goddessCubesPath, 'utf8'));
    const trustedMappings = JSON.parse(
        fs.readFileSync(trustedMappingJsonPath, 'utf8'),
    );
    const trustedMappingByHdName = new Map(
        trustedMappings.map((mapping) => [mapping.hdName, mapping]),
    );
    const existingMappingByHdName = parseExistingMappingDoc(
        existingMappingDocPath,
    );

    const auditLocations = apworldLocations
        .map((apworldLocation) => {
            const randoAccesses =
                randoWorldLogic.get(apworldLocation.name) ?? [];
            const randoRegions = unique(
                randoAccesses.map((access) => access.hintRegion),
            );
            const trackerPath = unique(
                randoRegions.map((region) =>
                    trackerPaths.get(region)?.join(' > '),
                ),
            ).join('<br>');

            const location = {
                apworldLocation,
                randoLocation: randoLocations.get(apworldLocation.name),
                randoAccesses,
                randoRegions,
                trackerPath,
                trustedMapping: trustedMappingByHdName.get(
                    apworldLocation.name,
                ),
                existingMapping: existingMappingByHdName.get(
                    apworldLocation.name,
                ),
            };

            return {
                ...location,
                action: classifyLocation(location),
            };
        })
        .sort((left, right) => {
            const leftRegion =
                left.randoRegions[0] ?? left.apworldLocation.region;
            const rightRegion =
                right.randoRegions[0] ?? right.apworldLocation.region;
            return (
                leftRegion.localeCompare(rightRegion) ||
                left.apworldLocation.name.localeCompare(
                    right.apworldLocation.name,
                )
            );
        });

    const apworldNames = new Set(
        apworldLocations.map((location) => location.name),
    );
    const randoLocationOnly = [...randoLocations.keys()]
        .filter((name) => !apworldNames.has(name))
        .sort();
    const randoWorldOnly = [...randoWorldLogic.keys()]
        .filter((name) => !apworldNames.has(name))
        .sort();

    return {
        apworldLocations,
        auditLocations,
        randoLocations,
        randoWorldLogic,
        randoLocationOnly,
        randoWorldOnly,
        trackerDump,
        goddessCubes,
        trustedMappings,
    };
}

function renderAudit(audit) {
    const {
        apworldLocations,
        auditLocations,
        randoLocations,
        randoWorldLogic,
        randoLocationOnly,
        randoWorldOnly,
        trackerDump,
        goddessCubes,
        trustedMappings,
    } = audit;

    const actionCounts = countBy(auditLocations, (location) => location.action);
    const missingRandoLocations = auditLocations.filter(
        (location) => !location.randoLocation,
    );
    const missingRandoWorldLogic = auditLocations.filter(
        (location) => location.randoAccesses.length === 0,
    );
    const unmappedLocations = auditLocations.filter(
        (location) => location.action !== 'trusted-existing-check',
    );
    const groupedUnmappedLocations = Map.groupBy(
        unmappedLocations,
        (location) =>
            location.randoRegions[0] ??
            location.apworldLocation.region ??
            'Unknown',
    );

    const lines = [
        '# SSHD Logic Audit',
        '',
        'Generated by `node scripts/generateSshdLogicAudit.mjs`.',
        '',
        'This audit compares SSHD Archipelago locations, the upstream SSHD rando logic data, and the current Wii-derived tracker checks.',
        '',
        '## Summary',
        '',
        `- APWorld HD locations: ${apworldLocations.length}`,
        `- SSHD rando data locations: ${randoLocations.size}`,
        `- SSHD rando world logic locations: ${randoWorldLogic.size}`,
        `- Current tracker raw Wii checks: ${trackerDump.rawChecks}`,
        `- Current tracker extra gossip stones: ${trackerDump.gossipStones}`,
        `- Current tracker goddess cube pairs: ${goddessCubes.length}`,
        `- Current tracker displayable total if extras are included: ${
            trackerDump.rawChecks +
            trackerDump.gossipStones +
            goddessCubes.length
        }`,
        `- Trusted APWorld -> current tracker mappings: ${trustedMappings.length}`,
        `- APWorld locations missing from rando locations.yaml: ${missingRandoLocations.length}`,
        `- APWorld locations missing from rando world logic: ${missingRandoWorldLogic.length}`,
        `- Rando locations not exposed by APWorld: ${randoLocationOnly.length}`,
        '',
        '## Action Counts',
        '',
        mdTable(
            ['Action', 'Count', 'Meaning'],
            [
                [
                    actionLabel('trusted-existing-check'),
                    actionCounts.get('trusted-existing-check') ?? 0,
                    'Already autotracked through an existing Wii tracker check.',
                ],
                [
                    actionLabel('review-existing-candidate'),
                    actionCounts.get('review-existing-candidate') ?? 0,
                    `Untrusted name match with score >= ${strongSuggestionMinScore}; review before trusting.`,
                ],
                [
                    actionLabel('weak-existing-candidate'),
                    actionCounts.get('weak-existing-candidate') ?? 0,
                    'Untrusted weak name match; likely needs manual review or a new check.',
                ],
                [
                    actionLabel('add-new-check'),
                    actionCounts.get('likely-new-check') ?? 0,
                    'No current tracker candidate; probably a new HD check to add.',
                ],
                [
                    actionLabel('missing-rando-logic'),
                    actionCounts.get('missing-rando-logic') ?? 0,
                    'APWorld location has no matching SSHD rando logic entry.',
                ],
            ],
        ),
        '',
        '## Unmapped APWorld Locations',
        '',
        'These APWorld locations are not in the trusted mapping used by the web tracker yet. The rando area and requirement come from `sshd-rando/data/world/*.yaml`.',
        '',
    ];

    for (const [region, locations] of [
        ...groupedUnmappedLocations.entries(),
    ].sort(([left], [right]) => left.localeCompare(right))) {
        lines.push(`### ${region} (${locations.length})`, '');
        lines.push(
            mdTable(
                [
                    'HD location',
                    'Rando area',
                    'Requirement',
                    'Types',
                    'Original item',
                    'Action',
                    'Suggested current tracker check',
                    'Score',
                ],
                locations.map((location) => [
                    location.apworldLocation.name,
                    unique(
                        location.randoAccesses.map((access) => access.area),
                    ).join('<br>'),
                    formatRequirement(location.randoAccesses),
                    (
                        location.randoLocation?.types ??
                        location.apworldLocation.types
                    ).join(', '),
                    location.randoLocation?.originalItem ??
                        location.apworldLocation.originalItem,
                    actionLabel(location.action),
                    location.existingMapping?.suggestedTrackerName ?? '',
                    location.existingMapping?.suggestedScore ?? '',
                ]),
            ),
            '',
        );
    }

    lines.push(
        '## Rando Locations Not Exposed By APWorld',
        '',
        'These are present in the SSHD rando data but absent from APWorld locations. In the current snapshot they are hint-only gossip stone entries, so they should not become item checks without review.',
        '',
        mdTable(
            ['Rando location', 'World logic area', 'Requirement'],
            randoLocationOnly.map((name) => {
                const accesses = randoWorldLogic.get(name) ?? [];
                return [
                    name,
                    unique(accesses.map((access) => access.area)).join('<br>'),
                    formatRequirement(accesses),
                ];
            }),
        ),
        '',
    );

    const randoWorldOnlyButNotLocationOnly = randoWorldOnly.filter(
        (name) => !randoLocationOnly.includes(name),
    );
    if (randoWorldOnlyButNotLocationOnly.length > 0) {
        lines.push(
            '## Rando World Logic Only',
            '',
            'These are present in world logic but absent from both APWorld and `locations.yaml`.',
            '',
            mdTable(
                ['Rando world logic location', 'Area', 'Requirement'],
                randoWorldOnlyButNotLocationOnly.map((name) => {
                    const accesses = randoWorldLogic.get(name) ?? [];
                    return [
                        name,
                        unique(accesses.map((access) => access.area)).join(
                            '<br>',
                        ),
                        formatRequirement(accesses),
                    ];
                }),
            ),
            '',
        );
    }

    return `${lines.join('\n')}\n`;
}

const audit = buildAudit();
const renderedAudit = renderAudit(audit);
fs.writeFileSync(auditDocPath, renderedAudit);
console.log(`Wrote ${auditDocPath}`);
