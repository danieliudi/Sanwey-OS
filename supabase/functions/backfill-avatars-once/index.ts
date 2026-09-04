// Migração interna ÚNICA (F-05) já executada com sucesso em 20/08/2026 —
// as 3 fotos legadas em base64 já foram movidas pro bucket 'avatars'.
// Este slug fica inerte de propósito (mesma lógica do stub deixado em
// analyze-lead) — não executa mais nada.
Deno.serve(async () => new Response("Gone — migração única já executada.", { status: 410 }));
