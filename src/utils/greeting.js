export function greetingFor(user) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = (user?.name || "").split(" ")[0];
  return first ? `${period}, ${first}` : period;
}

export default greetingFor;
