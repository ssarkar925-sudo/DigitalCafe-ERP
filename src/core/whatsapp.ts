import { WhatsAppConfig, DEFAULT_WHATSAPP_CONFIG } from "./contracts";

export interface SendWhatsAppResult {
  success: boolean;
  mode: "GATEWAY" | "WA_ME";
  messageId?: string;
  error?: string;
}

/**
 * Retrieves the currently saved WhatsApp configuration from localStorage,
 * falling back to clean defaults.
 */
export function getSavedWhatsAppConfig(): WhatsAppConfig {
  try {
    const saved = localStorage.getItem("dc_whatsapp_config");
    if (saved) {
      return { ...DEFAULT_WHATSAPP_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    // fallback to default
  }
  return DEFAULT_WHATSAPP_CONFIG;
}

/**
 * Normalizes phone number into international E.164 format digits (defaulting to +91).
 */
export function normalizeWhatsAppNumber(rawPhone?: string, defaultPrefix = "91"): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.length === 10) {
    digits = defaultPrefix.replace(/[^0-9]/g, "") + digits;
  }
  return digits;
}

/**
 * Dispatches a WhatsApp message in 1 click:
 * 1. Checks if Local Gateway (http://localhost:3001) or Cloud Gateway (Render) is active.
 * 2. Attempts background HTTP POST to `${gatewayUrl}/send-message` with a 4s timeout.
 * 3. If the gateway succeeds, delivers directly to recipient's WhatsApp without opening tabs!
 * 4. If gateway is offline or unreachable, seamlessly falls back to wa.me instant link window.
 */
export async function sendWhatsAppMessage(
  phone: string | undefined,
  messageText: string,
  onNotify?: (msg: string) => void
): Promise<SendWhatsAppResult> {
  const config = getSavedWhatsAppConfig();
  const cleanPhone = normalizeWhatsAppNumber(phone, config.defaultCountryCode);
  const gatewayUrl = (config.gatewayUrl || "http://localhost:3001").replace(/\/+$/, "");

  // If phone is provided, attempt 1-click Gateway background dispatch
  if (cleanPhone) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${gatewayUrl}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.gatewayApiKey ? { "x-api-key": config.gatewayApiKey } : {}),
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message: messageText,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          if (onNotify) {
            onNotify(`✓ WhatsApp delivered in 1-click via Gateway to +${cleanPhone}!`);
          }
          return { success: true, mode: "GATEWAY", messageId: data.messageId };
        }
      }
    } catch (err: any) {
      // Gateway unreachable or timed out -> seamless fallback to wa.me
      console.warn("[WhatsApp Dispatch] Gateway unavailable, falling back to wa.me:", err?.message);
    }
  }

  // Fallback: wa.me instant direct dispatch
  const encodedText = encodeURIComponent(messageText);
  const targetUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  if (onNotify) {
    onNotify(cleanPhone ? `✓ WhatsApp ready for +${cleanPhone}!` : "✓ WhatsApp ready to share!");
  }

  return { success: true, mode: "WA_ME" };
}
