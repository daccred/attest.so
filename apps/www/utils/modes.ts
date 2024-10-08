/* eslint-disable import/no-relative-packages -- required */
import {
    LayoutIcon,
    LibraryIcon,
    PaperclipIcon,
    type LucideIcon,
} from 'lucide-react';

export interface Mode {
    param: string;
    name: string;
    package: string;
    description: string;
    version: string;
    icon: LucideIcon;
}

export const modes: Mode[] = [
    {
        param: 'solana',
        name: 'SOLANA',
        package: 'fumadocs-core',
        description: '',
        version: '13.4.10',
        icon: LibraryIcon,
    },
    {
        param: 'stellar',
        name: 'STELLAR',
        package: 'fumadocs-ui',
        description: 'The user interface',
        version: '13.4.10',
        icon: LayoutIcon,
    },
    {
        param: 'starknet',
        name: 'STARKNET',
        package: 'fumadocs-mdx',
        description: 'Built-in source provider',
        version: '13.4.10',
        icon: PaperclipIcon,
    },
];
