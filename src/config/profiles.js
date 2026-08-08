/**
 * Central configuration for profiles (roles), their modules and menu items.
 * Used by ProfileSelector, the layouts and access control (RBAC).
 */
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Wrench,
  DollarSign,
  ShoppingCart,
  UserCog,
  MapPin,
  Building2,
  Calendar,
  FileText,
  ShieldCheck,
  Store,
  History,
  CalendarClock,
} from 'lucide-react';

/** Each role points to a module (route prefix) and has its own menu. */
export const PROFILES = {
  admin: {
    label: 'ADM Master',
    description: 'Gestão financeira, usuários, estoque, OS e relatórios',
    icon: ShieldCheck,
    basePath: '/admin',
    home: '/admin/dashboard',
    menu: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/admin/financeiro', label: 'Financeiro', icon: DollarSign },
      { to: '/admin/clientes', label: 'Clientes', icon: Users },
      { to: '/admin/estoque', label: 'Estoque', icon: Package },
      { to: '/admin/manutencoes', label: 'Manutenção Preventiva', icon: CalendarClock },
      { to: '/admin/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList },
      { to: '/admin/servicos', label: 'Delegação de Serviços', icon: Wrench },
      { to: '/admin/colaboradores', label: 'Colaboradores', icon: UserCog },
      { to: '/admin/vendas-externas', label: 'Vendas Externas', icon: Store },
      { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
    ],
  },

  vendedor_interno: {
    label: 'Vendedor Interno',
    description: 'PDV, frente de caixa e controle de estoque',
    icon: ShoppingCart,
    basePath: '/vendedor-interno',
    home: '/vendedor-interno/pdv',
    menu: [
      { to: '/vendedor-interno/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/vendedor-interno/pdv', label: 'PDV / Vendas', icon: ShoppingCart },
      { to: '/vendedor-interno/vendas-do-dia', label: 'Vendas do dia', icon: ClipboardList },
      { to: '/vendedor-interno/estoque', label: 'Estoque', icon: Package },
      { to: '/vendedor-interno/clientes', label: 'Clientes', icon: Users },
    ],
  },

  vendedor_externo: {
    label: 'Vendedor Externo',
    description: 'Vendas em campo, orçamentos e clientes',
    icon: MapPin,
    basePath: '/vendedor-externo',
    home: '/vendedor-externo/dashboard',
    menu: [
      { to: '/vendedor-externo/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/vendedor-externo/clientes', label: 'Clientes', icon: Users },
      { to: '/vendedor-externo/vendas', label: 'Meus Pedidos', icon: ClipboardList },
      { to: '/vendedor-externo/orcamentos', label: 'Orçamentos', icon: FileText },
    ],
  },

  tecnico: {
    label: 'Funcionário Condominial',
    description: 'Ordens de serviço, tarefas e manutenções',
    icon: Building2,
    basePath: '/condominial',
    home: '/condominial/dashboard',
    menu: [
      { to: '/condominial/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/condominial/agenda', label: 'Minha Agenda', icon: Calendar },
      { to: '/condominial/historico', label: 'Histórico', icon: History },
      { to: '/condominial/orcamentos', label: 'Orçamentos / OS', icon: FileText },
      { to: '/condominial/clientes', label: 'Clientes', icon: Users },
    ],
  },
};

export const ROLES = Object.keys(PROFILES);

/**
 * Returns all the roles a user can access.
 * user.roles (array) takes priority over user.role (legacy string).
 */
export function userRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  return user.role ? [user.role] : [];
}

/** Checks whether the user can access a basePath. */
export function canAccess(user, basePath) {
  const roles = userRoles(user);
  if (roles.includes('admin')) return true;
  return roles.some((r) => PROFILES[r]?.basePath === basePath);
}

/** Home of the user's first role. */
export function homeFor(user) {
  const roles = userRoles(user);
  if (roles.includes('admin')) return PROFILES.admin.home;
  return PROFILES[roles[0]]?.home || '/';
}

/** True if the user has more than 1 profile available. */
export function hasMultipleProfiles(user) {
  const roles = userRoles(user);
  if (roles.includes('admin')) return true; // admin accesses everything
  return roles.length > 1;
}
