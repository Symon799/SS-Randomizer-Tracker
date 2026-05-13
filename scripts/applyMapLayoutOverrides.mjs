import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const mapDataPath = path.join(repoRoot, 'src', 'data', 'mapData.json');
const layoutDebugPath = path.join(
    repoRoot,
    'src',
    'locationTracker',
    'mapTracker',
    'layoutDebug.ts',
);

function printUsage() {
    console.log(
        'Usage: npm run apply:mapLayout -- <overrides.json>\n' +
            '   or: npm run finalize:mapLayout -- <overrides.json>\n' +
            '   or: node scripts/applyMapLayoutOverrides.mjs <overrides.json> [--disable-debug]',
    );
}

function isOverride(value) {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.x === 'number' &&
        typeof value.y === 'number'
    );
}

function loadOverridePayload(raw) {
    const parsed = JSON.parse(raw);
    if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'overrides' in parsed &&
        typeof parsed.overrides === 'object' &&
        parsed.overrides !== null
    ) {
        return parsed.overrides;
    }
    return parsed;
}

function resolveEntry(mapData, debugPath) {
    if (debugPath === 'sky') {
        return { skipped: 'sky override is intentionally ignored' };
    }

    const parts = debugPath.split('.');
    if (parts.length === 0) {
        return { skipped: 'empty debug path' };
    }

    let current = mapData;

    for (const part of parts) {
        const match = /^([A-Za-z0-9_]+)\[(\d+)\]$/.exec(part);
        if (match) {
            const [, key, indexText] = match;
            const index = Number(indexText);
            const value = current?.[key];
            if (!Array.isArray(value) || index >= value.length) {
                return {
                    skipped: `path segment ${part} not found in mapData`,
                };
            }
            current = value[index];
            continue;
        }

        if (!(part in current)) {
            return {
                skipped: `path segment ${part} not found in mapData`,
            };
        }
        current = current[part];
    }

    if (
        typeof current !== 'object' ||
        current === null ||
        !('markerX' in current) ||
        !('markerY' in current)
    ) {
        return {
            skipped: 'resolved entry does not expose markerX/markerY',
        };
    }

    return { entry: current };
}

async function main() {
    const args = process.argv.slice(2);
    const disableDebug = args.includes('--disable-debug');
    const inputPath = args.find((arg) => !arg.startsWith('--'));
    if (!inputPath) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    const resolvedInputPath = path.resolve(process.cwd(), inputPath);
    const [overridesRaw, mapDataRaw] = await Promise.all([
        fs.readFile(resolvedInputPath, 'utf8'),
        fs.readFile(mapDataPath, 'utf8'),
    ]);

    const overrides = loadOverridePayload(overridesRaw);
    if (typeof overrides !== 'object' || overrides === null) {
        throw new Error('Override file must contain a JSON object');
    }

    const mapData = JSON.parse(mapDataRaw);
    const applied = [];
    const skipped = [];

    for (const [debugPath, override] of Object.entries(overrides)) {
        if (!isOverride(override)) {
            skipped.push(`${debugPath}: invalid override payload`);
            continue;
        }

        const result = resolveEntry(mapData, debugPath);
        if ('skipped' in result) {
            skipped.push(`${debugPath}: ${result.skipped}`);
            continue;
        }

        result.entry.markerX = override.x;
        result.entry.markerY = override.y;
        applied.push(debugPath);
    }

    await fs.writeFile(mapDataPath, `${JSON.stringify(mapData, null, 4)}\n`);

    if (disableDebug) {
        const layoutDebugSource = await fs.readFile(layoutDebugPath, 'utf8');
        const updatedLayoutDebugSource = layoutDebugSource.replace(
            'export const ENABLE_MAP_LAYOUT_DEBUG = true;',
            'export const ENABLE_MAP_LAYOUT_DEBUG = false;',
        );
        if (updatedLayoutDebugSource !== layoutDebugSource) {
            await fs.writeFile(layoutDebugPath, updatedLayoutDebugSource);
            console.log('Disabled map layout debug mode in src/locationTracker/mapTracker/layoutDebug.ts');
        } else {
            console.log('Map layout debug mode was already disabled.');
        }
    }

    console.log(`Applied ${applied.length} map layout override(s).`);
    for (const debugPath of applied) {
        console.log(`  updated ${debugPath}`);
    }

    if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} override(s).`);
        for (const reason of skipped) {
            console.log(`  ${reason}`);
        }
    }

    console.log(`Updated ${path.relative(process.cwd(), mapDataPath)}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
