-- Achado F-02 (ALTO) da auditoria funcional de 19/08/2026: o trigger
-- sync_profile_to_colaborador dispara em TODO INSERT em profiles sem olhar
-- o cargo, então qualquer conta — agência, cliente, fornecedor, portal —
-- nasce como FUNCIONÁRIO ATIVO do Grupo Sanwey em rh_colaboradores. É por
-- isso que a Beehave (agência externa) aparece hoje como colaboradora
-- 'ativo' na lista de Funcionários do RH.
--
-- Adiciona a mesma guarda que chat_sync_channel_membership() já usa
-- corretamente para o mesmo problema — só espelha o predicado, não inventa
-- um novo.

create or replace function public.sync_profile_to_colaborador()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.roles && array['agencia','cliente','fornecedor','portal']::text[] then
    return new;
  end if;
  insert into public.rh_colaboradores (profile_id, full_name, email, employee_status, frente)
  values (new.id, new.name, new.email, 'ativo', new.frente)
  on conflict (profile_id) do nothing;
  return new;
end;
$function$;

-- Limpa a única linha real já afetada por este bug: a agência externa
-- Beehave, que a guarda acima agora impede de se repetir. Não mexe em
-- `profiles` (a conta continua existindo, só deixa de ter uma linha de
-- "funcionário" que nunca deveria ter tido) e não mexe em nenhuma outra
-- linha de rh_colaboradores — o filtro é exatamente o mesmo predicado da
-- guarda, então só remove o que o trigger corrigido nunca teria criado.
delete from public.rh_colaboradores rc
using public.profiles p
where rc.profile_id = p.id
  and p.roles && array['agencia','cliente','fornecedor','portal']::text[];

