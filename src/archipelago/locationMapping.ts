import type { Logic } from '../logic/Logic';

function normalizeApLocationName(name: string): string {
    return name.replaceAll('’', "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function getAreaShortName(areaId: string): string {
    const parts = areaId.split('\\').filter(Boolean);
    return parts.at(-1) ?? areaId;
}

export function buildSshdApLocationResolver(logic: Logic) {
    const exactAliases = new Map<string, string>();
    const normalizedAliases = new Map<string, string>();
    const virtualLocationsBySuffix = new Map<string, string>();

    const addAlias = (alias: string, target: string) => {
        exactAliases.set(alias, target);
        normalizedAliases.set(normalizeApLocationName(alias), target);
    };

    for (const [fullName, checkInfo] of Object.entries(logic.checks)) {
        addAlias(checkInfo.name, fullName);
        if (checkInfo.type === 'goddess_cube') {
            addAlias(`${checkInfo.name} (Cube Strike)`, fullName);
        }
    }

    for (const area of Object.values(logic.areaGraph.areas)) {
        if (area.abstract) {
            continue;
        }
        for (const location of area.locations) {
            if (
                location.type !== 'virtualLocation' ||
                !location.id.startsWith('\\') ||
                location.id.slice(1).includes('\\')
            ) {
                continue;
            }

            addAlias(
                `${getAreaShortName(area.id)} - ${location.id.slice(1)}`,
                location.id,
            );
            virtualLocationsBySuffix.set(
                normalizeApLocationName(location.id.slice(1)),
                location.id,
            );
        }
    }

    return (apLocationName: string) => {
        const direct =
            exactAliases.get(apLocationName) ??
            normalizedAliases.get(normalizeApLocationName(apLocationName));
        if (direct !== undefined) {
            return direct;
        }

        const separatorIndex = apLocationName.indexOf(' - ');
        if (separatorIndex === -1) {
            return undefined;
        }

        return virtualLocationsBySuffix.get(
            normalizeApLocationName(apLocationName.slice(separatorIndex + 3)),
        );
    };
}
