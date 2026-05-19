import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="rounded-2xl flex items-center justify-center mb-4"
        style={{ width: 60, height: 60, background: "#F1F3F5" }}
      >
        <Icon size={26} color={NEUTRAL.slate} strokeWidth={1.5} />
      </div>
      <div className="font-semibold mb-1.5" style={{ color: NEUTRAL.graphite, fontSize: 15 }}>{title}</div>
      <div className="text-sm max-w-sm mb-5 leading-relaxed" style={{ color: NEUTRAL.slate }}>{description}</div>
      {action}
    </div>
  );
}

export default EmptyState;
