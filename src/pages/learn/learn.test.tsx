import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { Route, Routes } from 'react-router'
import { activateLocale } from '~i18n/i18n'
import { renderWithProviders } from '../../test-utils'
import { GLOSSARY, filterGlossary, readGlossary } from './glossary'
import { pickExamples } from './examples'
import { LearnPage } from './index'
import { TOPIC_GROUPS, TOPICS, findTopic, neighbours } from './topics'

// The content files, raw, to check every glossary link has a target.
const sources = import.meta.glob('./content/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

function renderLearn(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path='/learn' element={<LearnPage />} />
      <Route path='/learn/:topic' element={<LearnPage />} />
    </Routes>,
    { route }
  )
}

// jsdom does not scroll; a deep link calls scrollIntoView.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {}
})
afterEach(() => activateLocale('en'))

describe('topics', () => {
  it('have unique slugs and walk in order', () => {
    expect(new Set(TOPICS.map((t) => t.slug)).size).toBe(TOPICS.length)
    expect(i18n._(findTopic('glossary')!.title)).toBe('Glossary')
    expect(findTopic('nope')).toBeNull()
    expect(neighbours(TOPICS[0]!.slug).prev).toBeNull()
    expect(neighbours(TOPICS[1]!.slug).prev?.slug).toBe(TOPICS[0]!.slug)
    expect(neighbours('glossary').next).toBeNull()
  })

  it('have a title, a summary and a group with a label', () => {
    for (const t of TOPICS) {
      expect(i18n._(t.title).length).toBeGreaterThan(3)
      expect(i18n._(t.summary).length).toBeGreaterThan(30)
      expect(TOPIC_GROUPS.some((g) => g.id === t.group)).toBe(true)
    }
    for (const g of TOPIC_GROUPS) expect(i18n._(g.label).length).toBeGreaterThan(3)
  })
})

describe('glossary', () => {
  it('has unique ids and a definition for each term', () => {
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length)
    for (const e of readGlossary(i18n)) {
      expect(e.text.length).toBeGreaterThan(30)
      expect(e.text.split('`').length % 2).toBe(1)
    }
  })

  it('filters by every word and sorts by term', () => {
    const all = readGlossary(i18n)
    expect(filterGlossary('', all)).toHaveLength(GLOSSARY.length)
    expect(all[0]!.term.localeCompare(all[1]!.term)).toBeLessThan(0)
    expect(filterGlossary('vote id', all).map((e) => e.id)).toContain('vote-id')
    expect(filterGlossary('zzzz', all)).toEqual([])
  })

  it('filters without regard to case or accents', () => {
    const items = [
      { id: 'a', term: 'Votación', text: 'Una papeleta cifrada.' },
      { id: 'b', term: 'Censo', text: 'Quién puede votar.' },
    ]
    expect(filterGlossary('votacion', items).map((e) => e.id)).toEqual(['a'])
    expect(filterGlossary('VOTACIÓN cifrada', items).map((e) => e.id)).toEqual(['a'])
    expect(filterGlossary('quien', items).map((e) => e.id)).toEqual(['b'])
  })

  it('keeps names from the code untranslated', () => {
    const names = GLOSSARY.filter((e) => typeof e.term === 'string').map((e) => e.term)
    expect(names).toEqual(['occupied_before', 'rootCVadcopFinal'])
  })

  it('has an entry for every term the guide links to', () => {
    const ids = new Set(GLOSSARY.map((e) => e.id))
    const used = Object.values(sources).flatMap((src) =>
      [...src.matchAll(/<Term id='([a-z0-9-]+)'/g)].map((m) => m[1]!)
    )
    expect(used.length).toBeGreaterThan(20)
    expect(used.filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('pickExamples', () => {
  it('picks nothing on an empty registry', () => {
    expect(pickExamples([])).toEqual({ active: null, withResults: null, dkg: null, newest: null })
  })
})

describe('LearnPage', () => {
  it('renders the index with every topic', () => {
    renderLearn('/learn')
    const page = screen.getByTestId('page-learn')
    for (const t of TOPICS.filter((x) => x.group !== 'verify')) {
      expect(within(page).getByTestId(`topic-card-${t.slug}`)).toBeInTheDocument()
    }
    expect(within(page).getByText('I voted')).toBeInTheDocument()
  })

  for (const t of TOPICS) {
    it(`renders ${t.slug}`, () => {
      renderLearn(`/learn/${t.slug}`)
      const article = screen.getByTestId('learn-topic')
      expect(article).toHaveAttribute('data-topic', t.slug)
      expect(within(article).getByRole('heading', { level: 1, name: i18n._(t.title) })).toBeInTheDocument()
    })
  }

  it('explains an unknown topic', () => {
    renderLearn('/learn/nope')
    expect(screen.getByText('No such topic')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Glossary' })).toBeInTheDocument()
  })

  it('keeps its section anchors in English', () => {
    renderLearn('/learn/census')
    expect(screen.getByRole('link', { name: 'Ballot slots' })).toHaveAttribute(
      'href',
      expect.stringMatching(/#ballot-slots$/)
    )
    expect(document.getElementById('ballot-slots')).toBeInTheDocument()
    cleanup()
    renderLearn('/learn/how-it-works')
    expect(document.getElementById('1-a-process-is-created')).toBeInTheDocument()
  })
})

describe('LearnPage in Spanish and Catalan', () => {
  // What a translation must not change: anchors, where links go and the code.
  function invariants(route: string) {
    const { container } = renderLearn(route)
    const sorted = (xs: Array<string | null>) => xs.map(String).sort()
    const out = {
      ids: sorted([...container.querySelectorAll('section[id], dl [id]')].map((e) => e.id)),
      hrefs: sorted([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))),
      code: sorted([...container.querySelectorAll('code')].map((c) => c.textContent)),
    }
    cleanup()
    return out
  }

  for (const locale of ['es', 'ca'] as const) {
    it(`${locale}: anchors, links and code stay as in English on every topic`, async () => {
      const routes = TOPICS.map((t) => `/learn/${t.slug}`)
      const english = routes.map(invariants)
      await activateLocale(locale)
      routes.forEach((route, i) => expect(invariants(route), route).toEqual(english[i]))
    })
  }

  it('reads the index and a glossary deep link in the active language', async () => {
    await activateLocale('ca')
    renderLearn('/learn')
    expect(screen.getByRole('heading', { level: 1, name: 'Com funciona DAVINCI' })).toBeInTheDocument()
    cleanup()

    await activateLocale('es')
    renderLearn('/learn/glossary#term-process-id')
    const entry = document.getElementById('term-process-id')!
    expect(entry).toHaveAttribute('aria-current', 'true')
    expect(within(entry).getByRole('term')).toHaveTextContent('Id de proceso')
  })
})
