import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Products from "./pages/Products";
import Clients from "./pages/Clients";
import SalesDashboard from "./pages/SalesDashboard";
import OneTimeSales from "./pages/OneTimeSales";
import Contracts from "./pages/Contracts";
import ContractBillings from "./pages/ContractBillings";
import Churns from "./pages/Churns";
import Reports from "./pages/Reports";
import Quizzes from "./pages/Quizzes";
import QuizEditor from "./pages/QuizEditor";
import QuizPlayer from "./pages/public/QuizPlayer";
import ClientPortal from "./pages/public/ClientPortal";
import InvoicePayment from "./pages/public/InvoicePayment";
import WorkspaceMembers from "./pages/WorkspaceMembers";
import Profile from "./pages/Profile";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import PipelineSettings from "./pages/PipelineSettings";
import FinancialLayout from "./layouts/FinancialLayout";
import FinancialOverview from "./pages/financial/FinancialOverview";
import FinancialReceivables from "./pages/financial/FinancialReceivables";
import FinancialPayables from "./pages/financial/FinancialPayables";
import FinancialReconciliation from "./pages/financial/FinancialReconciliation";
import FinancialStatement from "./pages/financial/FinancialStatement";
import FinancialDRE from "./pages/financial/FinancialDRE";
import FinancialSettings from "./pages/financial/FinancialSettings";
import DashboardLayout from "./layouts/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import Operations from "./pages/Operations";
import Tasks from "./pages/Tasks";
import Squads from "./pages/Squads";
import SquadDetails from "./pages/SquadDetails";
import ClientOperations from "./pages/ClientOperations";
import RolesAndPermissions from "./pages/settings/RolesAndPermissions";
import InvitePage from "./pages/public/InvitePage";
import PrivacyPolicy from "./pages/public/PrivacyPolicy";
import TermsOfService from "./pages/public/TermsOfService";
import Suppliers from "./pages/Suppliers";
import KnowledgeBase from "./pages/KnowledgeBase";
import SdrDashboard from "./pages/sdr/SdrDashboard";
import SdrQrCode from "./pages/sdr/SdrQrCode";
import SdrFeedbacks from "./pages/sdr/SdrFeedbacks";
import SdrSugestoes from "./pages/sdr/SdrSugestoes";
import SdrSugerirConhecimento from "./pages/sdr/SdrSugerirConhecimento";
import { AdminRoute } from "@/components/AdminRoute";
import AdminRequests from "@/pages/dashboard/admin/AdminRequests";
import ArtesHub from "@/pages/artes/ArtesHub";
import ArtesNova from "@/pages/artes/ArtesNova";
import ArtesDetalhe from "@/pages/artes/ArtesDetalhe";

import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/invite/:code" element={<InvitePage />} />
            <Route path="/quiz/:slug" element={<QuizPlayer />} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="/invoice/:id" element={<InvoicePayment />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="crm" element={<CRM />} />
              <Route path="products" element={<Products />} />
              <Route path="quizzes" element={<Quizzes />} />
              <Route path="quizzes/:id" element={<QuizEditor />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="clients" element={<Clients />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="contract-billings" element={<ContractBillings />} />
              <Route path="sales" element={<SalesDashboard />} />
              {/* <Route path="one-time-sales" element={<OneTimeSales />} /> */}
              <Route path="churns" element={<Churns />} />
              <Route path="reports" element={<Reports />} />
              <Route path="workspace-members" element={<WorkspaceMembers />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<WorkspaceSettings />} />
              <Route path="settings/roles" element={<RolesAndPermissions />} />
              <Route path="pipeline-settings" element={<Navigate to="/dashboard/settings?tab=pipeline" replace />} />

              <Route path="admin" element={<AdminRoute />}>
                <Route path="requests" element={<AdminRequests />} />
              </Route>
              <Route path="financial" element={<FinancialLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<FinancialOverview />} />
                <Route path="receivables" element={<FinancialReceivables />} />
                <Route path="payables" element={<FinancialPayables />} />
                <Route path="reconciliation" element={<FinancialReconciliation />} />
                <Route path="statement" element={<FinancialStatement />} />
                <Route path="dre" element={<FinancialDRE />} />
                <Route path="settings" element={<FinancialSettings />} />
              </Route>

              <Route path="operations" element={<Operations />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="squads" element={<Navigate to="/dashboard/settings?tab=squads" replace />} />
              <Route path="squads/:id" element={<SquadDetails />} />
              <Route path="clients/:id/operations" element={<ClientOperations />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="sdr" element={<SdrDashboard />} />
              <Route path="sdr/whatsapp" element={<SdrQrCode />} />
              <Route path="sdr/feedbacks" element={<SdrFeedbacks />} />
              <Route path="sdr/sugestoes" element={<SdrSugestoes />} />
              <Route path="sdr/sugerir" element={<SdrSugerirConhecimento />} />
              <Route path="artes" element={<ArtesHub />} />
              <Route path="artes/nova" element={<ArtesNova />} />
              <Route path="artes/:id" element={<ArtesDetalhe />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
