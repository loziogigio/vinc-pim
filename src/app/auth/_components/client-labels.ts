export function getAuthClientLabel(clientId?: string): string | null {
  if (!clientId) return null;

  const names: Record<string, string> = {
    "vinc-b2b": "VINC B2B Portal",
    "vinc-vetrina": "Ufficio Digitale",
    "vinc-commerce-suite": "VINC Commerce Suite",
    "vinc-mobile": "VINC Mobile App",
    "vinc-pim": "VINC PIM",
  };

  return names[clientId] || clientId;
}
