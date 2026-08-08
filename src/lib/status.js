/** Status maps → label + Badge tone, reused across the screens. */

export const CLIENT_STATUS = {
  ativo: { label: 'Ativo', tone: 'success' },
  aguardando_validacao: { label: 'Aguardando validação', tone: 'warning' },
  rejeitado: { label: 'Rejeitado', tone: 'danger' },
};

export const OS_STATUS = {
  aguardando_validacao: { label: 'Aguardando validação', tone: 'warning' },
  validada: { label: 'Validada', tone: 'primary' },
  nao_validada: { label: 'Não validada', tone: 'danger' },
  em_execucao: { label: 'Em execução', tone: 'primary' },
  concluida: { label: 'Concluída', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'muted' },
};

export const SALE_STATUS = {
  consolidada: { label: 'Consolidada', tone: 'success' },
  cancelada: { label: 'Cancelada', tone: 'muted' },
  reserva: { label: 'Reserva', tone: 'warning' },
  pendente_envio: { label: 'Pendente envio', tone: 'warning' },
};

/** External order (salesperson → ADM). Only becomes a sale when approved. */
export const ORDER_STATUS = {
  enviado: { label: 'Aguardando ADM', tone: 'warning' },
  aprovado: { label: 'Aprovado', tone: 'success' },
  rejeitado: { label: 'Rejeitado', tone: 'danger' },
};

export const TASK_STATUS = {
  agendado: { label: 'Agendado', tone: 'primary' },
  em_andamento: { label: 'Em andamento', tone: 'warning' },
  concluido: { label: 'Concluído', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
};

export const PAYMENT_STATUS = {
  a_receber: { label: 'A receber', tone: 'warning' },
  recebido: { label: 'Recebido', tone: 'success' },
};

export const CLIENT_TYPE = {
  condominio: 'Condomínio',
  pessoa_fisica: 'Pessoa Física',
  pessoa_juridica: 'Pessoa Jurídica',
};

export const PAYMENT_METHOD = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
};
