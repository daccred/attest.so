import { createMDXSource } from 'fumadocs-mdx';
import type { InferMetaType, InferPageType } from 'fumadocs-core/source';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';
import { attachFile, createOpenAPI } from 'fumadocs-openapi/server';
import { create } from '@/components/ui/icon';
import { meta, docs } from '@/.source';

export const utils = loader({
  baseUrl: '/docs',
  icon(icon) {
    if (icon && icon in icons)
      return create({ icon: icons[icon as keyof typeof icons] });
  },
  source: createMDXSource(docs, meta),
  pageTree: {
    attachFile,
  },
});

export const openapi = createOpenAPI({});

export type Page = InferPageType<typeof utils>;
export type Meta = InferMetaType<typeof utils>;
