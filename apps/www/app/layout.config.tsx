import Image from 'next/image';
import { utils } from '@/app/source';
import { modes } from '@/utils/modes';
import { Logo } from '@/components/ui/logo'
import { NavChildren } from './layout.client'
import { type DocsLayoutProps } from 'fumadocs-ui/layout';
import { type HomeLayoutProps } from 'fumadocs-ui/home-layout';
import { BookIcon, Heart, LayoutTemplateIcon } from 'lucide-react';
import { RootToggle } from 'fumadocs-ui/components/layout/root-toggle';


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

export const docsOptions: DocsLayoutProps = {
  ...baseOptions,
  tree: utils.pageTree,
  nav: {
    ...baseOptions.nav,
    transparentMode: 'none',
    children: undefined,
  },
  sidebar: {
    banner: (
      <RootToggle
        options={modes.map((mode) => ({
          url: `/docs/${mode.param}`,
          icon: (
            <mode.icon
              className="size-9 shrink-0 rounded-md bg-gradient-to-t from-fd-background/80 p-1.5"
              style={{
                backgroundColor: `hsl(var(--${mode.param}-color)/.3)`,
                color: `hsl(var(--${mode.param}-color))`,
              }}
            />
          ),
          title: mode.name,
          description: mode.description,
        }))}
      />
    ),
  },
};

