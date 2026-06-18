/**
 * Demo Access Email
 *
 * Sent to a lead after they submit the "Richiedi demo" form on the marketing
 * site. Hands over the three demo surfaces (B2B portal, B2C shop, Commerce
 * Suite admin) with login + password, plus the guideline/hub link.
 *
 * The demo is lead-gated and the credentials are shared + auto-reset, so it is
 * acceptable to deliver them in the email body.
 */

import { renderBaseTemplate, renderButton, type EmailBranding } from "./base";
import type { DemoAccessEntry } from "@/lib/demo/demo-access";

export interface DemoAccessEmailOptions {
  branding: EmailBranding;
  /** Lead's name, if captured (already raw — escaped here). */
  leadName?: string;
  /** Access matrix (surface → url/login/password). */
  access: DemoAccessEntry[];
  /** Guideline / hub page URL. */
  hubUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSurface(entry: DemoAccessEntry, primaryColor: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8f9fb;border:1px solid #eaeef2;border-radius:8px;margin:0 0 16px 0;">
      <tr>
        <td style="padding:20px;">
          <p style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#1e293b;">${escapeHtml(entry.surface)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:2px 0;font-size:13px;color:#64748b;width:90px;">Login</td>
              <td style="padding:2px 0;font-size:13px;color:#1e293b;font-weight:600;">${escapeHtml(entry.login)}</td>
            </tr>
            <tr>
              <td style="padding:2px 0;font-size:13px;color:#64748b;">Password</td>
              <td style="padding:2px 0;"><code style="font-size:13px;color:#1e293b;font-weight:600;font-family:monospace;background-color:#f1f5f9;padding:2px 8px;border-radius:4px;">${escapeHtml(entry.password)}</code></td>
            </tr>
          </table>
          ${entry.note ? `<p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">${escapeHtml(entry.note)}</p>` : ""}
          ${renderButton(`Apri ${escapeHtml(entry.surface)}`, entry.url, primaryColor)}
        </td>
      </tr>
    </table>
  `.trim();
}

export function renderDemoAccessEmail(options: DemoAccessEmailOptions): string {
  const { branding, leadName, access, hubUrl } = options;
  const greeting = leadName ? `Ciao ${escapeHtml(leadName)},` : "Ciao,";

  const content = `
    <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#1e293b;">
      La tua demo è pronta 🎉
    </h2>
    <p style="margin:0 0 4px 0;font-size:15px;color:#475569;">${greeting}</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#64748b;">
      Grazie per aver richiesto una demo di Vendere in Cloud. Qui sotto trovi
      gli accessi alle tre superfici della piattaforma.<br/>
      <span style="font-size:13px;color:#94a3b8;">Thanks for requesting a VINC demo — your access details are below.</span>
    </p>

    ${access.map((e) => renderSurface(e, branding.primaryColor)).join("")}

    <p style="margin:24px 0 0 0;font-size:14px;color:#475569;">
      Tutte le istruzioni e i link in un'unica pagina:
    </p>
    ${renderButton("Apri la guida alla demo", hubUrl, branding.secondaryColor || branding.primaryColor)}

    <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">
      La demo è un ambiente condiviso e viene ripristinato periodicamente: le
      modifiche che fai non sono permanenti. / The demo is a shared environment
      and resets periodically.
    </p>
  `;

  return renderBaseTemplate({
    branding,
    preheader: "I tuoi accessi alla demo di Vendere in Cloud",
    content,
    footerText: "Demo access — Vendere in Cloud",
  });
}
