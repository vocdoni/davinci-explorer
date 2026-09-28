import { createBrowserRouter, type RouteObject } from 'react-router'
import { Shell } from '~app/Shell'
import { RouteError } from '~pages/error'
import { NotFoundPage } from '~pages/not-found'
import { patterns } from './paths'
import {
  ContractsPage,
  KitPage,
  LearnPage,
  OverviewPage,
  Lazy,
  ProcessesPage,
  ProcessPage,
  SequencersPage,
  TransitionPage,
  TxPage,
  VerifyDeploymentPage,
  VerifyElectionPage,
  VerifyPage,
  VerifyVotePage,
} from './pages'
import { LegacyVoteRedirect } from './redirects'

/** The route table, shared by the browser router and the tests' memory router. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <OverviewPage />
          </Lazy>
        ),
      },
      {
        path: patterns.processes,
        element: (
          <Lazy>
            <ProcessesPage />
          </Lazy>
        ),
      },
      {
        path: patterns.process,
        element: (
          <Lazy>
            <ProcessPage />
          </Lazy>
        ),
      },
      {
        path: patterns.transition,
        element: (
          <Lazy>
            <TransitionPage />
          </Lazy>
        ),
      },
      {
        path: patterns.processTab,
        element: (
          <Lazy>
            <ProcessPage />
          </Lazy>
        ),
      },
      {
        path: patterns.tx,
        element: (
          <Lazy>
            <TxPage />
          </Lazy>
        ),
      },
      {
        path: patterns.verify,
        element: (
          <Lazy>
            <VerifyPage />
          </Lazy>
        ),
      },
      {
        path: patterns.verifyVote,
        element: (
          <Lazy>
            <VerifyVotePage />
          </Lazy>
        ),
      },
      {
        path: patterns.verifyElection,
        element: (
          <Lazy>
            <VerifyElectionPage />
          </Lazy>
        ),
      },
      {
        path: patterns.verifyElectionProcess,
        element: (
          <Lazy>
            <VerifyElectionPage />
          </Lazy>
        ),
      },
      {
        path: patterns.verifyDeployment,
        element: (
          <Lazy>
            <VerifyDeploymentPage />
          </Lazy>
        ),
      },
      { path: patterns.legacyVotes, element: <LegacyVoteRedirect /> },
      { path: patterns.legacyVote, element: <LegacyVoteRedirect /> },
      {
        path: patterns.contracts,
        element: (
          <Lazy>
            <ContractsPage />
          </Lazy>
        ),
      },
      {
        path: patterns.sequencers,
        element: (
          <Lazy>
            <SequencersPage />
          </Lazy>
        ),
      },
      {
        path: patterns.sequencer,
        element: (
          <Lazy>
            <SequencersPage />
          </Lazy>
        ),
      },
      {
        path: patterns.learn,
        element: (
          <Lazy>
            <LearnPage />
          </Lazy>
        ),
      },
      {
        path: patterns.learnTopic,
        element: (
          <Lazy>
            <LearnPage />
          </Lazy>
        ),
      },
      {
        path: patterns.kit,
        element: (
          <Lazy>
            <KitPage />
          </Lazy>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
