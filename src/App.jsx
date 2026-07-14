import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import RegionPage from './pages/RegionPage';
import UniversityPage from './pages/UniversityPage';
import SearchPage from './pages/SearchPage';
import DashboardPage from './pages/DashboardPage';
import AllProgramsPage from './pages/AllProgramsPage';
import ProgramPage from './pages/ProgramPage';
import CalendarPage from './pages/CalendarPage';
import WizardPage from './pages/WizardPage';
import EmailPage from './pages/EmailPage';
import NotFoundPage from './pages/NotFoundPage';
import UniversityComparePage from './pages/UniversityComparePage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/regiao/:regionName" element={<RegionPage />} />
            <Route path="/universidade/:regionName/:uniKey" element={<UniversityPage />} />
            <Route path="/busca" element={<SearchPage />} />
            <Route path="/editais" element={<DashboardPage />} />
            <Route path="/todos-programas" element={<AllProgramsPage />} />
            <Route path="/programa/:regionName/:uniKey/:programIdx" element={<ProgramPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/filtro" element={<WizardPage />} />
            <Route path="/comparar" element={<UniversityComparePage />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
