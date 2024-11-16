import type { Metadata } from 'next';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
  DocsCategory,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { type ComponentProps, type FC, Fragment } from 'react';
import defaultComponents from 'fumadocs-ui/mdx';
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-ui/twoslash/popup';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { getImageMeta } from 'fumadocs-ui/og';
// import Preview from '@/components/preview';
import { createMetadata } from '@/utils/metadata';
import { openapi, utils } from '@/app/source';
// import { Wrapper } from '@/components/preview/wrapper';

interface Param {
  slug: string[];
}

export default function Page({
  params,
}: {
  params: Param;
}): React.ReactElement {
  const page = utils.getPage(params.slug);

  if (!page) notFound();

  const path = `apps/docs/content/docs/${page.file.path}`;

  return (
    <DocsPage
      toc={page.data.toc}
      lastUpdate={page.data.lastModified}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
        single: false,
      }}
      editOnGithub={{
        repo: 'attest.so',
        owner: 'daccred',
        sha: 'canary',
        path,
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <page.data.body
          components={{
            ...defaultComponents,
            Popup,
            PopupContent,
            PopupTrigger,
            Tabs,
            Tab,
            TypeTable,
            Accordion,
            Accordions,
            blockquote: Callout as unknown as FC<ComponentProps<'blockquote'>>,
            APIPage: openapi.APIPage,
          }}
        />
        {page.data && 'index' in page.data && page.data.index ? (
          <DocsCategory page={page} pages={utils.getPages()} />
        ) : null}
      </DocsBody>
    </DocsPage>
  );
}

export function generateMetadata({ params }: { params: Param }): Metadata {
  const page = utils.getPage(params.slug);

  if (!page) notFound();

  const description =
    page.data.description ?? 'Https for the blockchain';

  const image = getImageMeta('og', page.slugs);

  return createMetadata({
    title: page.data.title,
    description,
    openGraph: {
      url: `/docs/${page.slugs.join('/')}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  });
}

export function generateStaticParams(): Param[] {
  return utils.generateParams();
}
