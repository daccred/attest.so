import Image from 'next/image';
import { Logo } from '@/components/ui/logo'
import { NavChildren } from './layout.client'
import { type HomeLayoutProps } from 'fumadocs-ui/home-layout';
import { BookIcon, Heart, LayoutTemplateIcon } from 'lucide-react';

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: HomeLayoutProps = {
  githubUrl: "https://github.com/daccred",
  nav: {
    title: (
      <>
        <Logo
          className="size-4 [header_&]:size-5"
          fill="currentColor" />

        <span className="font-medium max-md:[header_&]:hidden">
          attest.docs
        </span>
      </>
    ),
    transparentMode: 'top',
    children: <NavChildren />,
  },
  links: [
    {
      icon: <BookIcon />,
      text: 'Blog',
      url: '/docs/solana',
      active: 'nested-url',
    },
    {
      text: 'Showcase',
      url: '/docs/solana',
      icon: <LayoutTemplateIcon />,
    },
    {
      text: 'Sponsors',
      url: '/docs/solana',
      icon: <Heart />,
    }
  ],
};
