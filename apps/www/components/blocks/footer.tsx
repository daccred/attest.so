'use client'

import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/assets/icons'

const Footer = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  const openModal = useCallback(() => {
    setIsModalOpen(true)
    document.body.classList.add('overflow-hidden')
  }, [])

  return (
    <footer className="flex flex-col md:flex-row justify-between md:items-center items-start p-4 bg-[#000]">
      <div className="flex flex-col">
        <p className="text-muted-primary font-pp-supply-mono text-sm">001</p>
        <p className="font-pp-supply-mono uppercase text-muted-foreground text-[20px] leading-[24px]">
          Streamline data verification, <br /> enhance transparency, and unlock the <br /> potential
          of decentralized trust.
        </p>
      </div>
      <div className="mt-4 md:mt-0">
        <Button type="button" onClick={openModal}>
          READ DOCS
          <Icons.ArrowRightUp className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </footer>
  )
}

export default Footer
