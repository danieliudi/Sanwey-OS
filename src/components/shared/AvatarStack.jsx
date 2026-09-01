import React from "react";

// Pilha de avatares sobrepostos (FASE 5) — substitui o círculo único de
// responsável em todo card que agora pode ter mais de uma pessoa. `users`
// é a lista já resolvida (objetos com name/avatarBg/avatarUrl/initials),
// não ids — quem chama resolve via `.filter(Boolean)` num map de ids.
//
// `dot` (01/09/2026) — ponto de notificação na quina do PRIMEIRO avatar,
// usado pelo card do Kanban pra sinalizar comentário não lido. Substitui o
// badge redondo preenchido que ficava na linha de chips e era o objeto mais
// pesado do card. Ancora no responsável, que é quem precisa ler.
//
// Geometria (decidida com o Daniel olhando as posições ampliadas): o centro
// do ponto tem que cair FORA da circunferência do avatar, senão ele morde o
// disco em vez de encostar na quina. Com right/top em -3px o centro fica a
// ~1,26 raio do centro do avatar — encosta sem cobrir. O anel de 2px na cor
// do card completa a separação. Não encolher esse offset.
//
// `position: relative` entra SÓ no avatar que carrega o ponto, nunca em
// todos: o `zIndex` da pilha é inerte em elemento estático, então hoje os
// avatares sobrepostos se pintam em ordem de DOM (o 2º por cima do 1º).
// Posicionar todos faria o zIndex passar a valer e inverteria essa ordem em
// 7+ telas — mudança visual fora do escopo de quem só queria um ponto.
export function AvatarStack({ users = [], size = 20, max = 3, dot = false, dotTitle }) {
  const list = users.filter(Boolean);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const overflow = list.length - shown.length;

  return (
    <div className="flex items-center" style={{ marginLeft: 4 }}>
      {shown.map((u, i) => (
        <div
          key={u.id || i}
          title={u.name}
          className={`flex items-center justify-center rounded-full font-bold shrink-0${dot && i === 0 ? " relative" : ""}`}
          style={{
            width: size, height: size, fontSize: size * 0.42, lineHeight: 1,
            background: u.avatarBg || "#1D4ED8", color: "#FFF",
            border: "1.5px solid var(--surface)",
            marginLeft: i === 0 ? 0 : -size * 0.35,
            backgroundImage: u.avatarUrl ? `url(${u.avatarUrl})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
            zIndex: shown.length - i,
          }}
        >
          {!u.avatarUrl && (u.initials || u.name?.slice(0, 2)?.toUpperCase() || "?")}
          {dot && i === 0 && (
            <span
              title={dotTitle}
              style={{
                position: "absolute", right: -3, top: -3,
                width: 9, height: 9, borderRadius: "50%",
                background: "var(--danger)",
                border: "2px solid var(--surface)",
                boxSizing: "content-box",
              }}
            />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-full font-bold shrink-0"
          style={{
            width: size, height: size, fontSize: size * 0.38,
            background: "var(--surface-alt)", color: "var(--text-dim)",
            border: "1.5px solid var(--surface)", marginLeft: -size * 0.35,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export default AvatarStack;
