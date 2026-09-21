import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';

import Login from '@/pages/Login';
import ProfileSelector from '@/pages/ProfileSelector';
import NotFound from '@/pages/NotFound';

// ADM Master
import AdminDashboard from '@/pages/admin/AdminDashboard';
import FinancialView from '@/pages/admin/FinancialView';
import ClientsPage from '@/pages/admin/ClientsPage';
import StockPage from '@/pages/admin/StockPage';
import MaintenancePlansPage from '@/pages/admin/MaintenancePlansPage';
import CollaboratorsPage from '@/pages/admin/CollaboratorsPage';
import CollaboratorDetailPage from '@/pages/admin/CollaboratorDetailPage';
import ServiceOrdersPage from '@/pages/admin/ServiceOrdersPage';
import ServiceDelegation from '@/pages/admin/ServiceDelegation';
import ExternalSalesPage from '@/pages/admin/ExternalSalesPage';
import UserManagement from '@/pages/admin/UserManagement';
import NotasFiscaisPage from '@/pages/admin/NotasFiscaisPage';

// Internal Salesperson
import VIDashboard from '@/pages/vendedor/VIDashboard';
import PDVPage from '@/pages/vendedor/PDVPage';
import SalesOfDayPage from '@/pages/vendedor/SalesOfDayPage';
import StockManagementPage from '@/pages/vendedor/StockManagementPage';
import VIClientsPage from '@/pages/vendedor/VIClientsPage';

// External Salesperson
import VEXDashboard from '@/pages/vendedor-externo/VEXDashboard';
import VEXClientesPage from '@/pages/vendedor-externo/VEXClientesPage';
import VEXClientePerfilPage from '@/pages/vendedor-externo/VEXClientePerfilPage';
import VEXNovoPedidoPage from '@/pages/vendedor-externo/VEXNovoPedidoPage';
import VEXMeusPedidosPage from '@/pages/vendedor-externo/VEXMeusPedidosPage';
import VEXOrcamentosPage from '@/pages/vendedor-externo/VEXOrcamentosPage';

// Condominial / Technician
import CondominialDashboard from '@/pages/condominial/CondominialDashboard';
import FCOAgendaPage from '@/pages/condominial/FCOAgendaPage';
import FCOHistoricoPage from '@/pages/condominial/FCOHistoricoPage';
import FCOOrcamentosPage from '@/pages/condominial/FCOOrcamentosPage';
import FCOTarefaDetalhePage from '@/pages/condominial/FCOTarefaDetalhePage';
import FCOClientesPage from '@/pages/condominial/FCOClientesPage';
import FCOClientePerfilPage from '@/pages/condominial/FCOClientePerfilPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Authenticated root — profile selection */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<ProfileSelector />} />
            </Route>

            {/* ── ADM MASTER ── */}
            <Route element={<ProtectedRoute basePath="/admin" />}>
              <Route path="/admin" element={<AppShell profileKey="admin" />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="financeiro" element={<FinancialView />} />
                <Route path="clientes" element={<ClientsPage />} />
                <Route path="estoque" element={<StockPage />} />
                <Route path="manutencoes" element={<MaintenancePlansPage />} />
                <Route path="colaboradores" element={<CollaboratorsPage />} />
                <Route path="colaboradores/:id" element={<CollaboratorDetailPage />} />
                <Route path="ordens-servico" element={<ServiceOrdersPage />} />
                <Route path="notas-fiscais" element={<NotasFiscaisPage />} />
                <Route path="servicos" element={<ServiceDelegation />} />
                <Route path="vendas-externas" element={<ExternalSalesPage />} />
                <Route path="usuarios" element={<UserManagement />} />
              </Route>
            </Route>

            {/* ── INTERNAL SALESPERSON ── */}
            <Route element={<ProtectedRoute basePath="/vendedor-interno" />}>
              <Route path="/vendedor-interno" element={<AppShell profileKey="vendedor_interno" />}>
                <Route index element={<Navigate to="pdv" replace />} />
                <Route path="dashboard" element={<VIDashboard />} />
                <Route path="pdv" element={<PDVPage />} />
                <Route path="vendas-do-dia" element={<SalesOfDayPage />} />
                <Route path="estoque" element={<StockManagementPage />} />
                <Route path="clientes" element={<VIClientsPage />} />
              </Route>
            </Route>

            {/* ── EXTERNAL SALESPERSON ── */}
            <Route element={<ProtectedRoute basePath="/vendedor-externo" />}>
              <Route path="/vendedor-externo" element={<AppShell profileKey="vendedor_externo" />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<VEXDashboard />} />
                <Route path="clientes" element={<VEXClientesPage />} />
                <Route path="clientes/:id" element={<VEXClientePerfilPage />} />
                <Route path="novo-pedido/:clientId" element={<VEXNovoPedidoPage />} />
                <Route path="vendas" element={<VEXMeusPedidosPage />} />
                <Route path="orcamentos" element={<VEXOrcamentosPage />} />
              </Route>
            </Route>

            {/* ── CONDOMINIAL EMPLOYEE (role: tecnico) ── */}
            <Route element={<ProtectedRoute basePath="/condominial" />}>
              <Route path="/condominial" element={<AppShell profileKey="tecnico" />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CondominialDashboard />} />
                <Route path="agenda" element={<FCOAgendaPage />} />
                <Route path="historico" element={<FCOHistoricoPage />} />
                <Route path="orcamentos" element={<FCOOrcamentosPage />} />
                <Route path="tarefas/:id" element={<FCOTarefaDetalhePage />} />
                <Route path="clientes" element={<FCOClientesPage />} />
                <Route path="clientes/:id" element={<FCOClientePerfilPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
