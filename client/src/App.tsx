// App.tsx — the route table (React Router).
// Every URL maps to a page component in pages/. All pages render inside <Layout />, which
// supplies the nav bar and footer, and inside <SessionProvider />, which knows who is signed in.
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { btn, Page } from './components/ui'
import { SessionProvider } from './lib/session'
import Landing from './pages/Landing'
import Onboard from './pages/Onboard'
import Teams from './pages/Teams'
import NewTeam from './pages/NewTeam'
import TeamDetail from './pages/TeamDetail'
import Hackers from './pages/Hackers'
import HackerProfile from './pages/HackerProfile'
import Inbox from './pages/Inbox'

// Shown for any URL that isn't in the table below.
function NotFound() {
  return (
    <Page className="text-center">
      <h1 className="font-display text-5xl font-semibold">Page not found</h1>
      <p className="mt-4 text-gray-300">That link doesn’t go anywhere.</p>
      <Link to="/teams" className={`${btn()} mt-8`}>
        Browse teams
      </Link>
    </Page>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* A layout route: Layout renders <Outlet />, where the matched child page appears. */}
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/onboard" element={<Onboard />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/teams/new" element={<NewTeam />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/hackers" element={<Hackers />} />
            <Route path="/hackers/:id" element={<HackerProfile />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
