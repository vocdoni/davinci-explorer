import type { ReactNode, SVGProps } from 'react'

// The Verify pages' own glyphs, drawn like the kit's: 16 px grid, 1.5 stroke,
// `currentColor`.

type Props = SVGProps<SVGSVGElement> & { size?: number }

function Glyph({ size = 16, children, ...rest }: Props & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      focusable='false'
      {...rest}
    >
      {children}
    </svg>
  )
}

/** A ballot with a tick: my vote. */
export const BallotIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M4 1.75h5.5L12.5 4.75v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.75a1 1 0 0 1 1-1z' />
    <path d='M9.25 1.75v3h3' />
    <path d='m5.5 9.25 1.6 1.6 3-3.1' />
  </Glyph>
)

/** A ballot going into a box: an election. */
export const BallotBoxIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M5.5 8.25V2.25h5v6' />
    <path d='M2.25 8.25h3.25M10.5 8.25h3.25v5.5H2.25v-5.5' />
    <path d='M6.5 11.25h3' />
  </Glyph>
)

/** A shield with a tick: the deployment. */
export const ShieldIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M8 1.75 13 3.75v3.9c0 3.1-2.1 5.5-5 6.6-2.9-1.1-5-3.5-5-6.6v-3.9z' />
    <path d='m5.75 8 1.55 1.55 2.95-3' />
  </Glyph>
)

/** A clock: not decided yet. */
export const ClockIcon = (p: Props) => (
  <Glyph {...p}>
    <circle cx='8' cy='8' r='5.75' />
    <path d='M8 4.75V8l2.25 1.5' />
  </Glyph>
)

/** A dash: does not apply. */
export const DashIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M4.5 8h7' />
  </Glyph>
)

export const ArrowRightIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M3 8h10' />
    <path d='m9 4 4 4-4 4' />
  </Glyph>
)

/** A terminal prompt: redo it on your computer. */
export const TerminalIcon = (p: Props) => (
  <Glyph {...p}>
    <rect x='1.75' y='2.75' width='12.5' height='10.5' rx='1.25' />
    <path d='m4.5 6.5 2 1.75-2 1.75' />
    <path d='M8.25 10.25h3' />
  </Glyph>
)

/** An eye: read in your browser. */
export const EyeIcon = (p: Props) => (
  <Glyph {...p}>
    <path d='M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z' />
    <circle cx='8' cy='8' r='1.9' />
  </Glyph>
)
