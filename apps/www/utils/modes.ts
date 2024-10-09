/* eslint-disable import/no-relative-packages -- required */
import {
    LayoutIcon,
    LibraryIcon,
    PaperclipIcon,
    type LucideIcon,
} from 'lucide-react';

import { SolanaIcon, StarknetIcon, StellarIcon } from '@/components/ui/icon';

export interface Mode {
    param: string;
    name: string;
    package: string;
    description: string;
    version: string;
    icon: LucideIcon | React.FC<React.SVGProps<SVGSVGElement>>;
}

export const modes: Mode[] = [
    {
        param: 'solana',
        name: 'Solana',
        package: 'Solana',
        description: 'Solana Attestation Service',
        version: '13.4.10',
        icon: SolanaIcon,
    },
    {
        param: 'stellar',
        name: 'Stellar',
        package: 'Stellar',
        description: 'Stellar Attestation Service',
        version: '13.4.10',
        icon: StellarIcon,
    },
    {
        param: 'starknet',
        name: 'Starknet',
        package: 'Starknet',
        description: 'Attest on Starknet',
        version: '13.4.10',
        icon: StarknetIcon,
    },
];
