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
      const parsed = JSON.parse(saved);
      // If user had previous default of localhost:3001 or empty, prefer Render Cloud
      return { ...DEFAULT_WHATSAPP_CONFIG, ...parsed };
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
 * 1. Checks configured gateway URL (or Render cloud default).
 * 2. Attempts background HTTP POST to `${gatewayUrl}/send-message` with a 5s timeout.
 * 3. If configured local gateway fails or is offline, tries Render Cloud gateway directly.
 * 4. If both are unreachable, seamlessly falls back to wa.me instant link window.
 */
export async function sendWhatsAppMessage(
  phone: string | undefined,
  messageText: string,
  onNotify?: (msg: string) => void
): Promise<SendWhatsAppResult> {
  const config = getSavedWhatsAppConfig();
  const cleanPhone = normalizeWhatsAppNumber(phone, config.defaultCountryCode);
  const primaryUrl = (config.gatewayUrl || "https://sccomm-whatsapp-gateway.onrender.com").replace(/\/+$/, "");
  const fallbackCloudUrl = "https://sccomm-whatsapp-gateway.onrender.com";

  // If phone is provided, attempt 1-click Gateway background dispatch
  if (cleanPhone) {
    // Helper to send to a specific gateway URL
    const tryGatewaySend = async (targetUrl: string, timeoutMs = 6000): Promise<any> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${targetUrl}/send-message`, {
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
        return await res.json().catch(() => ({}));
      }
      return null;
    };

    // Attempt 1: Configured Primary Gateway
    try {
      const data = await tryGatewaySend(primaryUrl, 5000);
      if (data && data.success) {
        if (onNotify) {
          onNotify(`✓ WhatsApp delivered in 1-click via Gateway to +${cleanPhone}!`);
        }
        return { success: true, mode: "GATEWAY", messageId: data.messageId };
      }
    } catch (err: any) {
      console.warn(`[WhatsApp Dispatch] Primary gateway (${primaryUrl}) unavailable:`, err?.message);
    }

    // Attempt 2: Auto-try Render Cloud Gateway if primary was localhost or different
    if (primaryUrl !== fallbackCloudUrl) {
      try {
        const data = await tryGatewaySend(fallbackCloudUrl, 8000);
        if (data && data.success) {
          if (onNotify) {
            onNotify(`✓ WhatsApp delivered in 1-click via Render Cloud to +${cleanPhone}!`);
          }
          return { success: true, mode: "GATEWAY", messageId: data.messageId };
        }
      } catch (err: any) {
        console.warn(`[WhatsApp Dispatch] Fallback cloud gateway unavailable:`, err?.message);
      }
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
