import React from 'react'
import Image from 'next/image'
import Stellar from '@/assets/logos/Stellar.png'
import Solana from '@/assets/logos/solana.png'
import Starknet from '@/assets/logos/starknet.svg'
import Sui from '@/assets/logos/sui.svg'
import StellarActive from '@/assets/logos/stellaractive.png'

const items = [
  { src: Stellar, alt: 'stellar', tooltip: 'Attest for Stellar', inactive: StellarActive },
  { src: Solana, alt: 'Solana', tooltip: 'Attest for Solana', inactive: StellarActive },
  // { src: Aptos, alt: 'Aptos', tooltip: 'Attest for Aptos', inactive: StellarActive },
  { src: Starknet, alt: 'Starknet', tooltip: 'Attest for Starknet', inactive: StellarActive },
  // { src: Stellar, alt: 'stellar', tooltip: 'Attest for Stellar', inactive: StellarActive },
  // { src: Cosmos, alt: 'Cosmos', tooltip: 'Attest for Cosmos', inactive: StellarActive },
  // { src: Solana, alt: 'Solana', tooltip: 'Attest for Solana', inactive: StellarActive },
  // { src: Sui, alt: 'Sui', tooltip: 'Attest for Sui', inactive: StellarActive },
]

const AttestedItems = () => {
  return (
    <div className="grid w-full gap-4 grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 mx-auto justify-items-center">
      {items.map((item, index) => (
        <div key={index} className="relative group text-center">
          <div className="w-36 h-24 relative">
            <Image src={item.src} alt={item.alt} fill className="object-contain cursor-pointer" />
            <Image
              src={item.inactive}
              alt="Inactive State"
              className="h-full w-full object-cover mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer hover:border hover:border-[#FF8700] rounded-full"
              unoptimized
              fill
            />
          </div>
          {/* Tooltip */}
          <div className="absolute left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-full">
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-8 border-b-white"></span>
            <span className="bg-white text-[#050505] text-sm py-2 px-2 rounded">
              {item.tooltip}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default AttestedItems
