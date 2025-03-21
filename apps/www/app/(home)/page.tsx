import React from 'react'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { StarsIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { AttestFullIcon } from '@/components/ui/logo'

import Footer from '@/components/blocks/footer'
import Header from '@/components/blocks/header'
import HeroBackdrop from '@/components/blocks/hero-backdrop'

export default function Page(): React.ReactElement {
  return (
    <main
      style={{
        backgroundImage: 'url(/stars.png)',
      }}
    >
      <div
        className="absolute inset-x-0 top-[200px] h-[250px] max-md:hidden"
        style={{
          background:
            'repeating-linear-gradient(to right, hsl(var(--primary)/.1),hsl(var(--primary)/.1) 1px,transparent 1px,transparent 50px), repeating-linear-gradient(to bottom, hsl(var(--primary)/.1),hsl(var(--primary)/.1) 1px,transparent 1px,transparent 50px)',
        }}
      />
      <div className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
        <div
          style={
            {
              // background:
              //   'repeating-linear-gradient(to bottom, transparent, hsl(var(--secondary)/.2) 500px, transparent 1000px)',
            }
          }
        >
          <div className="relative">
            <StarsIcon
              className="absolute -left-2 -top-2 z-10 size-4 xl:scale-[200%]"
              stroke="none"
              fill="currentColor"
            />
            <StarsIcon
              className="absolute -bottom-2 -right-2 z-10 size-4 xl:scale-[200%]"
              stroke="none"
              fill="currentColor"
            />
            <section className="flex flex-col min-h-screen">
              <HeroBackdrop />
              <Footer />
              <PreFooter />
              <Header />
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function PreFooter(): React.ReactElement {
  return (
    <div className="container relative z-[2] flex flex-col items-center overflow-hidden border-x border-t bg-fd-background px-6 pt-12 text-center md:pt-20 [.uwu_&]:hidden">
      <h1 className="mb-6 text-8xl md:text-5xl tracking-tighter">attest to all things</h1>
      <p className="mb-6 h-fit p-2 text-fd-muted-foreground md:max-w-[80%] md:text-xl">
        We’re building <b className="font-medium text-fd-foreground">https on the blockchain</b>.
        <br />
        Build anything from network states, DAOs, DePIN, and RWA. <br /> Never worry about trust
        again.
      </p>
      <div className="inline-flex items-center gap-3">
        <Link
          href="/docs/solana"
          className={cn(buttonVariants({ size: 'lg', className: 'rounded-full' }))}
        >
          Getting Started
        </Link>
        <a
          href="https://explorer.attest.so"
          className={cn(
            buttonVariants({
              size: 'lg',
              variant: 'outline',
              className: 'rounded-full bg-fd-background',
            })
          )}
        >
          Open explorer
        </a>
      </div>
      <svg
        viewBox="0 0 500 500"
        className="mb-[-150px] mt-16 size-[300px] duration-1000 animate-in slide-in-from-bottom-[500px] dark:invert md:mb-[-250px] md:size-[500px]"
      >
        <defs>
          <filter id="noiseFilter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.6"
              numOctaves="1"
              seed="15"
              result="turbulence"
            />
            <feComposite in="SourceGraphic" in2="turbulence" operator="in" />
            <feComposite in2="SourceGraphic" operator="lighter" />
          </filter>
          <radialGradient id="Gradient1" cx="50%" cy="50%" r="80%" fx="10%" fy="10%">
            <stop stopColor="white" offset="35%" />
            <stop stopColor="black" offset="100%" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="250" r="250" fill="url(#Gradient1)" filter="url(#noiseFilter)" />
      </svg>
      <div
        className="absolute inset-0 z-[-1]"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse at top, transparent 60%, hsl(var(--primary) / 0.2))',
            'linear-gradient(to bottom, transparent 30%, hsl(var(--primary) / 0.2))',
            'linear-gradient(to bottom, hsl(var(--background)) 40%, transparent)',
            'repeating-linear-gradient(45deg, transparent,transparent 60px, hsl(var(--primary)) 61px, transparent 62px)',
          ].join(', '),
        }}
      />
    </div>
  )
}
