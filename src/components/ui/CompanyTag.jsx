import React from "react";
import { Badge } from "./Badge";
import { COMPANIES } from "../../constants/companies";

export function CompanyTag({ companyId, size = "sm" }) {
  const c = COMPANIES[companyId];
  if (!c) return null;
  return (
    <Badge size={size} customColor={c.primary}>
      {c.short}
    </Badge>
  );
}

export default CompanyTag;
