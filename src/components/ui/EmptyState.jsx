import React from "react";
import { NEUTRAL } from "../../constants/companies";

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="rounded-sm flex items-center justify-center mb-4"
        style={{ width: 56, height: 56, background: "#F5F5F3" }}
      >
        <Icon size={24} color={NEUTRAL.slate} strokeWidth={1.5} />
      </div>
      <div className="font-semibold mb-1" style={{ color: NEUTRAL.graphite }}>{title}</div>
      <div className="text-sm max-w-sm mb-4" style={{ color: NEUTRAL.slate }}>{description}</div>
      {action}
    </div>
  );
}

export default EmptyState;
