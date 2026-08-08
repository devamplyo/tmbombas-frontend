import { useState } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { db } from '@/api/client';
import useAsyncData from '@/hooks/useAsyncData';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import Card, { CardBody } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Field';
import { PROFILES } from '@/config/profiles';
import shared from '../shared.module.css';
import styles from './UserManagement.module.css';

const ROLE_LABELS = Object.fromEntries(Object.entries(PROFILES).map(([k, v]) => [k, v.label]));
// ADM Master isn't assignable via the UI — it's a system role (unique in the database)
const ASSIGNABLE_ROLES = Object.keys(PROFILES).filter((r) => r !== 'admin');

// Detects the ADM Master (system role, not editable via the UI)
const isAdminUser = (u) => u?.role === 'admin' || (Array.isArray(u?.roles) && u.roles.includes('admin'));

const EMPTY = { full_name: '', matricula: '', plain_password: '', roles: ['vendedor_interno'], position: '', phone: '', is_active: true };


export default function UserManagement() {
  const toast = useToast();
  const { data: users, loading, reload } = useAsyncData(() => db.User.list(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});

  const openNew = () => { setForm(EMPTY); setEditingId(null); setEditingAdmin(false); setOpen(true); };
  const openEdit = (u) => {
    // compatibility with legacy records that only have `role`
    const admin = isAdminUser(u);
    const rawRoles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role || 'vendedor_interno'];
    // removes 'admin' from the roles editable in the checkboxes — that role is fixed by the system
    const roles = rawRoles.filter((r) => r !== 'admin');
    setForm({ ...EMPTY, ...u, roles: roles.length ? roles : ['vendedor_interno'] });
    setEditingId(u.id);
    setEditingAdmin(admin);
    setOpen(true);
  };

  const toggleRole = (role) => {
    setForm((f) => {
      if (f.roles.includes(role)) {
        if (f.roles.length === 1) return f; // minimum of 1 profile
        return { ...f, roles: f.roles.filter((r) => r !== role) };
      }
      return { ...f, roles: [...f.roles, role] };
    });
  };

  const save = async () => {
    if (!form.full_name.trim()) return toast.error('Informe o nome.');
    if (!form.matricula.trim()) return toast.error('Informe a matrícula.');
    if (!editingId && !form.plain_password.trim()) return toast.error('Informe a senha.');
    if (!editingAdmin && !form.roles.length) return toast.error('Selecione pelo menos 1 perfil.');

    // The ADM Master keeps their system role; other users never receive 'admin' through this UI
    const safeRoles = editingAdmin ? ['admin'] : form.roles.filter((r) => r !== 'admin');

    try {
      const payload = { ...form, roles: safeRoles, role: safeRoles[0] };
      if (editingId) {
        await db.User.update(editingId, payload);
        toast.success('Usuário atualizado.');
      } else {
        const existing = await db.User.filter({ matricula: form.matricula });
        if (existing.length) return toast.error('Matrícula já existe.');
        await db.User.create(payload);
        toast.success('Usuário criado.');
      }
      setOpen(false); reload();
    } catch (e) { toast.error(e.message); }
  };

  const toggleActive = async (u) => {
    await db.User.update(u.id, { is_active: !u.is_active });
    toast.success(u.is_active ? 'Usuário desativado.' : 'Usuário ativado.');
    reload();
  };

  const getRoleLabels = (u) => {
    const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role];
    return roles.map((r) => ROLE_LABELS[r] || r).join(', ');
  };

  if (loading) return <div className={shared.loading}><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Usuários" subtitle="Gerenciar acessos e credenciais"
        actions={<Button onClick={openNew}><Plus size={18} /> Novo usuário</Button>} />
      <Card>
        <CardBody style={{ padding: 0 }}>
          <Table
            columns={[
              { key: 'full_name', header: 'Nome' },
              { key: 'matricula', header: 'Matrícula' },
              { key: 'roles', header: 'Perfis', render: getRoleLabels },
              { key: 'position', header: 'Cargo', render: (r) => r.position || '—' },
              {
                key: 'plain_password', header: 'Senha', render: (r) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {showPasswords[r.id] ? r.plain_password : '••••••'}
                    <button onClick={() => setShowPasswords((p) => ({ ...p, [r.id]: !p[r.id] }))}
                      style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', lineHeight: 0 }}>
                      {showPasswords[r.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </span>
                ),
              },
              { key: 'is_active', header: 'Status', render: (r) => <Badge tone={r.is_active ? 'success' : 'muted'}>{r.is_active ? 'Ativo' : 'Inativo'}</Badge> },
              {
                key: 'actions', header: '', align: 'right',
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Editar</Button>
                    <Button size="sm" variant={r.is_active ? 'ghost' : 'outline'} onClick={() => toggleActive(r)}>
                      {r.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={users || []}
            empty="Nenhum usuário."
          />
        </CardBody>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar usuário' : 'Novo usuário'}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
        <div className={shared.formGrid}>
          <div style={{ gridColumn: '1/-1' }}>
            <Input label="Nome completo*" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <Input label="Matrícula*" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} disabled={!!editingId} />
          <Input label="Senha" type="text" placeholder={editingId ? '(deixe em branco para manter)' : ''} value={form.plain_password} onChange={(e) => setForm({ ...form, plain_password: e.target.value })} />
          <Input label="Cargo" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <div style={{ gridColumn: '1/-1' }}>
            {editingAdmin ? (
              <>
                <p className={styles.rolesLabel}>Perfil de acesso</p>
                <p className={styles.rolesHint} style={{ margin: 0 }}>
                  Este é o ADM Master — tem acesso total ao sistema. O perfil é fixo e não pode ser alterado.
                </p>
              </>
            ) : (
              <>
                <p className={styles.rolesLabel}>Perfis de acesso* <span className={styles.rolesHint}>(pode selecionar mais de 1)</span></p>
                <div className={styles.rolesGrid}>
                  {ASSIGNABLE_ROLES.map((role) => {
                    const checked = form.roles.includes(role);
                    return (
                      <label key={role} className={[styles.roleCard, checked ? styles.roleChecked : ''].join(' ')}>
                        <input type="checkbox" checked={checked} onChange={() => toggleRole(role)} />
                        <span>{ROLE_LABELS[role]}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
