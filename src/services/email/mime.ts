import { formatAddressHeader } from "@/lib/utils/email-text";
import type { OutgoingMessage } from "./providers/types";

/** Header values must never contain CR/LF — that is how header-injection attacks work. */
function headerValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** RFC 2047 encoded-word for non-ASCII subjects. */
function encodeSubject(subject: string): string {
  const clean = headerValue(subject);
  return /^[\x00-\x7F]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function wrapBase64(b64: string): string {
  return b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** Builds a plain-text RFC 2822 message, suitable for Gmail's `users.messages.send`. */
export function buildMimeMessage(message: OutgoingMessage): string {
  const headers = [
    `From: ${headerValue(formatAddressHeader([message.from]))}`,
    `To: ${headerValue(formatAddressHeader(message.to))}`,
    message.cc.length ? `Cc: ${headerValue(formatAddressHeader(message.cc))}` : null,
    `Subject: ${encodeSubject(message.subject)}`,
    message.inReplyTo ? `In-Reply-To: ${headerValue(message.inReplyTo)}` : null,
    message.references?.length ? `References: ${headerValue(message.references.join(" "))}` : null,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ].filter(Boolean);

  const body = wrapBase64(Buffer.from(message.textBody.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64"));
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}
