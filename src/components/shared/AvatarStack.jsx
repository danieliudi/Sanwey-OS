import React from "react";

// Pilha de avatares sobrepostos (FASE 5) — substitui o círculo único de
// responsável em todo card que agora pode ter mais de uma pessoa. `users`
// é a lista já resolvida (objetos com name/avatarBg/avatarUrl/initials),
// não ids — quem chama resolve via `.filter(Boolean)` num map de ids.
export function AvatarStack({ users = [], size = 20, max = 3 }) {
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
          className="flex items-center justify-center rounded-full font-bold shrink-0"
          style={{
            width: size, height: size, fontSize: size * 0.42,
            background: u.avatarBg || "#1D4ED8", color: "#FFF",
            border: "1.5px solid var(--surface)",
            marginLeft: i === 0 ? 0 : -size * 0.35,
            backgroundImage: u.avatarUrl ? `url(${u.avatarUrl})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
            zIndex: shown.length - i,
          }}
        >
          {!u.avatarUrl && (u.initials || u.name?.slice(0, 2)?.toUpperCase() || "?")}
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
