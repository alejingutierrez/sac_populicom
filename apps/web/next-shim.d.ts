declare module "next" {
  export type Metadata = {
    title?: string;
    description?: string;
  };

  export type NextConfig = Record<string, unknown>;
}

declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type Metadata = {
    title?: string;
    description?: string;
  };

  export type ResolvingMetadata = Promise<Metadata>;
  export type ResolvedMetadata = Metadata;
  export type Viewport = Record<string, string | number>;
  export type ResolvingViewport = Promise<Viewport>;
  export type ResolvedViewport = Viewport;
}

declare module "next/link" {
  import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

  export default function Link(
    props: ComponentPropsWithoutRef<"a"> & {
      href: string;
      children?: ReactNode;
    }
  ): ReactElement;
}

declare module "next/link.js" {
  export { default } from "next/link";
}

declare module "next/navigation" {
  export function useRouter(): {
    push(href: string): void;
    replace(href: string): void;
    refresh(): void;
  };

  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
}

declare module "next/navigation.js" {
  export * from "next/navigation";
}

declare module "next/server" {
  export class NextRequest extends Request {}

  export class NextResponse extends Response {
    static json<T>(body: T, init?: ResponseInit): NextResponse;
  }
}

declare module "next/server.js" {
  export * from "next/server";
}

declare module "next/headers" {
  export function headers(): Headers | Promise<Headers>;
}

declare module "next/headers.js" {
  export * from "next/headers";
}

declare module "next/font/google" {
  type FontOptions = {
    subsets?: string[];
    variable?: string;
    weight?: string[] | string;
  };

  export function IBM_Plex_Sans(options: FontOptions): { variable: string };
  export function Sora(options: FontOptions): { variable: string };
}

declare module "next/font/google/index.js" {
  export * from "next/font/google";
}

declare module "next/types.js" {
  export type Metadata = {
    title?: string;
    description?: string;
  };

  export type PageProps = {
    params?: Promise<Record<string, string>>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  };

  export type ResolvingMetadata = Promise<Metadata>;
  export type ResolvedMetadata = Metadata;
  export type Viewport = Record<string, string | number>;
  export type ResolvingViewport = Promise<Viewport>;
  export type ResolvedViewport = Viewport;
}
