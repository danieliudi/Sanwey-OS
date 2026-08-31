-- Razão social do cliente, separada do "Nome" (que pode ser fantasia ou um
-- apelido comercial digitado à mão) — mesmo modelo que leads.razao_social já
-- usa. Decidido com o Daniel 27/08/2026: coluna nova (não reaproveitar
-- `name`), pra não perder o nome comercial que já existe em 38 clientes.
-- Nullable, sem default: preenchida pela busca de CNPJ (cnpj-lookup) ou à
-- mão; não migra os cadastros já existentes.
alter table public.clients add column if not exists razao_social text;
