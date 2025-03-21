import React from 'react'
import AttestedItems from './attested-items'

const HeroBackdrop = () => {
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="flex flex-col items-center justify-center w-full max-w-screen-lg gap-10 bg-contain bg-no-repeat bg-center h-[400px] sm:h-[500px] md:h-[600px] lg:h-[800px]"
        style={
          {
            // backgroundImage: 'url(/stars.png)',
          }
        }
      >
        <h1 className="text-center uppercase text-4xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl text-white leading-tight font-mona-sans font-medium w-full">
          Built for <br /> Everyone. Attest <br /> to Anything
        </h1>

        <AttestedItems />
      </div>
    </div>
  )
}

export default HeroBackdrop
