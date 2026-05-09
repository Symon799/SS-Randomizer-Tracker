import type { LogicalState } from '../logic/Locations';

export type ColorScheme = { [logicalState in LogicalState]: string } & {
    background: string;
    text: string;
    interact: string;
    required: string;
    unrequired: string;
    checked: string;
    apFiller: string;
    apProgression: string;
    apTrap: string;
    apUseful: string;
    apLocation: string;
    apEntrance: string;
    apThisPlayer: string;
    apOtherPlayer: string;
};

export const lightColorScheme: ColorScheme = {
    outLogic: '#D94242',
    inLogic: '#1D88C9',
    semiLogic: '#D97B18',
    background: '#F8FAFC',
    text: '#172033',
    interact: '#2563EB',
    required: '#1D4ED8',
    unrequired: '#778196',
    checked: '#64748B',
    trickLogic: '#16803D',
    apFiller: '#0F766E',
    apProgression: '#A855F7',
    apTrap: '#E11D48',
    apUseful: '#4F46E5',
    apLocation: '#16A34A',
    apEntrance: '#1D4ED8',
    apThisPlayer: '#BE185D',
    apOtherPlayer: '#B45309',
};

export const darkColorScheme: ColorScheme = {
    ...lightColorScheme,
    background: '#000000',
    text: '#FFFFFF',
    checked: '#B6B6B6',
    apFiller: 'cyan',
    apThisPlayer: 'magenta',
    apOtherPlayer: 'palegoldenrod',
};
