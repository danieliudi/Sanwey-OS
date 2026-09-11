-- Importação de colaboradores por planilha (e-mail · Departamento · Nome).
--
-- Decidido com o Daniel em 11/09/2026, sobre mockup. As três regras que ele
-- fechou: casa por E-MAIL; quem já existe é ATUALIZADO (inclusive o nome);
-- departamento entra exatamente como está escrito, sem normalizar acento ou
-- caixa.
--
-- Por que uma função no banco e não três chamadas do navegador: a PRÉVIA e a
-- GRAVAÇÃO precisam decidir a mesma coisa. Calcular "o que vai mudar" em
-- JavaScript e gravar em SQL é o jeito clássico de os dois divergirem — a
-- prévia diz 12 atualizações e o banco faz 11, e ninguém descobre. Aqui é a
-- mesma função, com `p_aplicar` decidindo só se escreve.
--
-- Entrada: jsonb array de {linha, email, nome, departamento}. O número da
-- linha vem do navegador porque é o número da linha DA PLANILHA — é o que a
-- pessoa procura pra corrigir, e o banco não tem como saber.

create or replace function public.importar_colaboradores(
  p_linhas jsonb,
  p_aplicar boolean default false
)
returns table(linha int, email text, nome text, departamento text, acao text, detalhe text)
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  v_id uuid;
  v_qtd int;
  v_nome_atual text;
  v_depto_atual text;
  v_mudancas text[];
  v_vistos text[] := array[]::text[];
  v_chave text;
begin
  if not public.current_user_is_rh() then
    raise exception 'Sem permissão';
  end if;
  if jsonb_typeof(p_linhas) <> 'array' then
    raise exception 'Formato inválido';
  end if;
  -- Teto: planilha de RH não tem 5 mil pessoas, e sem limite um arquivo
  -- errado vira uma transação que segura a tabela por minutos.
  if jsonb_array_length(p_linhas) > 2000 then
    raise exception 'A planilha tem mais de 2000 linhas. Divida em partes.';
  end if;

  for r in
    select (x->>'linha')::int              as linha,
           btrim(coalesce(x->>'email',''))        as email,
           btrim(coalesce(x->>'nome',''))         as nome,
           btrim(coalesce(x->>'departamento','')) as departamento
    from jsonb_array_elements(p_linhas) x
    order by (x->>'linha')::int
  loop
    linha        := r.linha;
    email        := r.email;
    nome         := r.nome;
    departamento := r.departamento;
    v_chave      := lower(r.email);

    -- Sem e-mail não há como saber se a pessoa já existe: importar assim
    -- criaria uma ficha nova a cada vez que a mesma planilha rodasse.
    if not public.email_utilizavel(r.email) then
      acao := 'ignorada';
      detalhe := case when r.email = '' then 'sem e-mail' else 'e-mail inválido' end;
      return next; continue;
    end if;

    if v_chave = any(v_vistos) then
      acao := 'ignorada';
      detalhe := 'e-mail repetido na planilha';
      return next; continue;
    end if;
    v_vistos := v_vistos || v_chave;

    -- `(array_agg(id))[1]` e não `min(id)`: o Postgres não tem min() pra uuid.
    select count(*), (array_agg(c.id))[1] into v_qtd, v_id
    from public.rh_colaboradores c
    where lower(btrim(coalesce(c.email,''))) = v_chave;

    if v_qtd > 1 then
      -- Não existe unicidade de e-mail na tabela. Se houver duas fichas com o
      -- mesmo endereço, escolher uma seria chute — e o chute fica gravado.
      acao := 'ignorada';
      detalhe := 'mais de uma ficha com esse e-mail — resolva no cadastro antes';
      return next; continue;
    end if;

    if v_qtd = 0 then
      if r.nome = '' then
        acao := 'ignorada'; detalhe := 'sem nome';
        return next; continue;
      end if;
      acao := 'criar';
      detalhe := null;
      if p_aplicar then
        insert into public.rh_colaboradores
          (full_name, email, department, employee_status, onboarding_stage, created_by)
        values
          (r.nome, r.email, nullif(r.departamento, ''), 'ativo',
           -- 'removido' é a etapa terminal que significa "fora do fluxo de
           -- onboarding", não "onboarding deu errado". Sem isto, importar 200
           -- pessoas jogaria 200 cartões em Pré-admissão. É a mesma etapa em
           -- que o RH já colocou à mão os 13 colaboradores antigos.
           'removido',
           (select auth.uid()));
      end if;
      return next; continue;
    end if;

    select c.full_name, coalesce(c.department, '') into v_nome_atual, v_depto_atual
    from public.rh_colaboradores c where c.id = v_id;

    v_mudancas := array[]::text[];
    if r.nome <> '' and r.nome is distinct from v_nome_atual then
      v_mudancas := v_mudancas || format('nome: %s → %s', v_nome_atual, r.nome);
    end if;
    if r.departamento <> '' and r.departamento is distinct from v_depto_atual then
      v_mudancas := v_mudancas || format('departamento: %s → %s',
        case when v_depto_atual = '' then '(vazio)' else v_depto_atual end, r.departamento);
    end if;

    if array_length(v_mudancas, 1) is null then
      acao := 'sem_mudanca'; detalhe := null;
      return next; continue;
    end if;

    acao := 'atualizar';
    detalhe := array_to_string(v_mudancas, ' · ');
    if p_aplicar then
      -- Só os dois campos que a planilha carrega. Cargo, salário, admissão,
      -- contrato e gestor não são tocados: campo que a planilha não traz não
      -- pode virar campo apagado.
      update public.rh_colaboradores c
         set full_name  = case when r.nome <> '' then r.nome else c.full_name end,
             department = case when r.departamento <> '' then r.departamento else c.department end,
             updated_at = now()
       where c.id = v_id;
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.importar_colaboradores(jsonb, boolean) from public, anon;
grant execute on function public.importar_colaboradores(jsonb, boolean) to authenticated;
