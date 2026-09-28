-- 0034_crm_schema.sql
-- Esquema del mini-CRM para negocios tipo "autonomo": pipeline de clientes (kanban),
-- agenda interna, presupuestos y facturas informativas. Ver README "Pendientes" /
-- memory/project-reservas-saas.md para contexto. RLS y RPCs en 0035/0036.

create type crm_stage_event_key as enum ('presupuesto_enviado', 'presupuesto_aceptado', 'factura_pagada');
create type crm_budget_status as enum ('borrador', 'enviado', 'aceptado', 'rechazado');
create type crm_invoice_status as enum ('emitida', 'pagada', 'anulada');
create type crm_event_type as enum ('visita', 'llamada', 'trabajo', 'otro');
create type crm_document_type as enum ('presupuesto', 'factura');

-- Etapas del pipeline, editables por cada autónomo (crear/renombrar/reordenar/color/eliminar).
create table public.crm_pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  color       text not null default '#64748b',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_crm_pipeline_stages_business on public.crm_pipeline_stages(business_id, position);

-- Mapeo opcional evento del flujo -> etapa del pipeline de ESE negocio (etapas editables,
-- así que el mapeo no puede ser fijo). Si no hay fila para un event_key, ese evento no
-- mueve ninguna tarjeta.
create table public.crm_stage_events (
  business_id uuid not null references public.businesses(id) on delete cascade,
  event_key   crm_stage_event_key not null,
  stage_id    uuid references public.crm_pipeline_stages(id) on delete set null,
  primary key (business_id, event_key)
);

-- Tarjeta del pipeline = un trabajo/oportunidad para un cliente.
create table public.crm_cards (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  customer_id       uuid references public.customers(id) on delete set null,
  stage_id          uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  title             text not null,
  description       text,
  estimated_amount  numeric(10, 2),
  position          int not null default 0,
  last_moved_at     timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_crm_cards_business_stage on public.crm_cards(business_id, stage_id, position);
create index idx_crm_cards_customer on public.crm_cards(business_id, customer_id);

create table public.crm_card_notes (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.crm_cards(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index idx_crm_card_notes_card on public.crm_card_notes(card_id, created_at);

-- Agenda interna (sin reserva pública ni widget): visitas, llamadas, trabajos...
create table public.crm_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  card_id     uuid references public.crm_cards(id) on delete set null,
  type        crm_event_type not null default 'otro',
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index idx_crm_events_business_time on public.crm_events(business_id, starts_at);
create index idx_crm_events_customer on public.crm_events(business_id, customer_id);

-- Datos fiscales configurables del autónomo (documento informativo, no factura legal).
create table public.crm_fiscal_profile (
  business_id        uuid primary key references public.businesses(id) on delete cascade,
  legal_name         text,
  nif                text,
  address            text,
  iban_note          text,
  default_vat_rate   numeric(5, 2) not null default 21,
  default_irpf_rate  numeric(5, 2) not null default 0,
  updated_at         timestamptz not null default now()
);

-- Catálogo de conceptos reutilizables al crear líneas de presupuesto/factura.
create table public.crm_budget_concepts (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  name                text not null,
  default_unit_price  numeric(10, 2) not null default 0,
  default_vat_rate    numeric(5, 2) not null default 21,
  created_at          timestamptz not null default now()
);
create index idx_crm_budget_concepts_business on public.crm_budget_concepts(business_id);

create table public.crm_budgets (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  customer_id        uuid not null references public.customers(id) on delete restrict,
  card_id            uuid references public.crm_cards(id) on delete set null,
  number             text not null,
  status             crm_budget_status not null default 'borrador',
  valid_until_days   int not null default 30,
  issued_at          timestamptz not null default now(),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (business_id, number)
);
create index idx_crm_budgets_business_status on public.crm_budgets(business_id, status);
create index idx_crm_budgets_customer on public.crm_budgets(business_id, customer_id);

create table public.crm_budget_lines (
  id             uuid primary key default gen_random_uuid(),
  budget_id      uuid not null references public.crm_budgets(id) on delete cascade,
  concept        text not null,
  quantity       numeric(10, 2) not null default 1,
  unit_price     numeric(10, 2) not null default 0,
  discount_pct   numeric(5, 2) not null default 0,
  vat_rate       numeric(5, 2) not null default 21,
  position       int not null default 0
);
create index idx_crm_budget_lines_budget on public.crm_budget_lines(budget_id, position);

create table public.crm_invoices (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete restrict,
  budget_id    uuid references public.crm_budgets(id) on delete set null,
  card_id      uuid references public.crm_cards(id) on delete set null,
  number       text not null,
  year         int not null,
  status       crm_invoice_status not null default 'emitida',
  irpf_rate    numeric(5, 2) not null default 0,
  issued_at    timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (business_id, number)
);
create index idx_crm_invoices_business_status on public.crm_invoices(business_id, status);
create index idx_crm_invoices_customer on public.crm_invoices(business_id, customer_id);

create table public.crm_invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.crm_invoices(id) on delete cascade,
  concept       text not null,
  quantity      numeric(10, 2) not null default 1,
  unit_price    numeric(10, 2) not null default 0,
  discount_pct  numeric(5, 2) not null default 0,
  vat_rate      numeric(5, 2) not null default 21,
  position      int not null default 0
);
create index idx_crm_invoice_lines_invoice on public.crm_invoice_lines(invoice_id, position);

-- Contador atómico para numeración correlativa sin huecos (ver crm_next_document_number
-- en 0036_crm_rpcs.sql). Nunca se escribe directamente desde el cliente.
create table public.crm_document_counters (
  business_id  uuid not null references public.businesses(id) on delete cascade,
  doc_type     crm_document_type not null,
  year         int not null,
  last_number  int not null default 0,
  primary key (business_id, doc_type, year)
);
