import React from "react";

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="rounded-2xl flex items-center justify-center mb-4"
        style={{ width: 60, height: 60, background: "var(--surface-alt)" }}
      >
        <Icon size={26} color="var(--text-dim)" strokeWidth={1.5} />
      </div>
      <div className="font-semibold mb-1.5" style={{ color: "var(--text)", fontSize: 15 }}>{title}</div>
      <div className="text-sm max-w-sm mb-5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{description}</div>
      {action}
    </div>
  );
}

export default EmptyState;
