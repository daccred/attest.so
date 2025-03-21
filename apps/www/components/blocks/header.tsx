'use client'
// import { AppLogo } from '../core/app-logo';
import { AttestFullIcon as HeaderLogo } from '@/components/ui/logo'

import { Icons } from '@/assets/icons'

export default function Header() {
  return (
    <header>
      <nav className="bg-[#000] p-6">
        <div className="flex flex-row justify-between items-start">
          <div className="flex items-start justify-start gap-5">
            <HeaderLogo />
          </div>
          <div className="flex flex-row gap-6 items-start">
            <h3 className="text-foreground text-base">12:46 AM GMT+1</h3>
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <Icons.Email className="h-5 w-5 text-muted-foreground " />
              <Icons.Instagram className="h-5 w-5 text-muted-foreground " />
              <Icons.Twitter className="h-5 w-5 text-muted-foreground " />
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
