import { describe, expect, it } from "vitest";
import { isBlockedUrl } from "../../app.js";

describe("isBlockedUrl", () => {
  // ---- should block ----

  it("blocks localhost by name", () => {
    expect(isBlockedUrl("http://localhost/")).toBe(true);
  });

  it("blocks 127.0.0.1 (standard loopback)", () => {
    expect(isBlockedUrl("http://127.0.0.1/")).toBe(true);
  });

  it("blocks 127.x.x.x range", () => {
    expect(isBlockedUrl("http://127.1.2.3/")).toBe(true);
  });

  it("blocks ::1 (IPv6 loopback)", () => {
    expect(isBlockedUrl("http://[::1]/")).toBe(true);
  });

  it("blocks 0.0.0.0", () => {
    expect(isBlockedUrl("http://0.0.0.0/")).toBe(true);
  });

  it("blocks 10.x.x.x private range", () => {
    expect(isBlockedUrl("http://10.0.0.1/")).toBe(true);
  });

  it("blocks 192.168.x.x private range", () => {
    expect(isBlockedUrl("http://192.168.1.1/")).toBe(true);
  });

  it("blocks 172.16.x.x–172.31.x.x private range", () => {
    expect(isBlockedUrl("http://172.16.0.1/")).toBe(true);
    expect(isBlockedUrl("http://172.31.255.255/")).toBe(true);
  });

  it("blocks 169.254.x.x link-local", () => {
    expect(isBlockedUrl("http://169.254.0.1/")).toBe(true);
  });

  it("blocks IPv6 ULA fc::/7", () => {
    expect(isBlockedUrl("http://[fc00::1]/")).toBe(true);
    expect(isBlockedUrl("http://[fd00::1]/")).toBe(true);
  });

  it("blocks IPv6 link-local fe80::/10", () => {
    expect(isBlockedUrl("http://[fe80::1]/")).toBe(true);
  });

  // ---- SSRF bypass: IPv4-mapped IPv6 ----

  it("blocks IPv4-mapped IPv6 dotted form ::ffff:127.0.0.1", () => {
    expect(isBlockedUrl("http://[::ffff:127.0.0.1]/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 hex-group form ::ffff:7f00:0001", () => {
    expect(isBlockedUrl("http://[::ffff:7f00:0001]/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 private ::ffff:192.168.1.1", () => {
    expect(isBlockedUrl("http://[::ffff:192.168.1.1]/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 private hex-group ::ffff:c0a8:0101 (192.168.1.1)", () => {
    expect(isBlockedUrl("http://[::ffff:c0a8:0101]/")).toBe(true);
  });

  // ---- SSRF bypass: alternative IPv4 notations ----

  it("blocks decimal-encoded 127.0.0.1 → 2130706433", () => {
    expect(isBlockedUrl("http://2130706433/")).toBe(true);
  });

  it("blocks hex-encoded 127.0.0.1 → 0x7f000001", () => {
    expect(isBlockedUrl("http://0x7f000001/")).toBe(true);
  });

  it("blocks octal-dotted 127.0.0.1 → 0177.0.0.1", () => {
    expect(isBlockedUrl("http://0177.0.0.1/")).toBe(true);
  });

  it("blocks decimal-encoded 10.0.0.1 → 167772161", () => {
    expect(isBlockedUrl("http://167772161/")).toBe(true);
  });

  // ---- should allow ----

  it("allows legitimate external HTTP URL", () => {
    expect(isBlockedUrl("https://example.com/")).toBe(false);
  });

  it("allows legitimate external IP address", () => {
    expect(isBlockedUrl("https://93.184.216.34/")).toBe(false);
  });

  it("allows 172.15.x.x (just outside RFC-1918 range)", () => {
    expect(isBlockedUrl("http://172.15.0.1/")).toBe(false);
  });

  it("allows 172.32.x.x (just outside RFC-1918 range)", () => {
    expect(isBlockedUrl("http://172.32.0.1/")).toBe(false);
  });

  // ---- edge cases ----

  it("blocks non-http/https scheme (file://)", () => {
    expect(isBlockedUrl("file:///etc/passwd")).toBe(true);
  });

  it("blocks malformed URL", () => {
    expect(isBlockedUrl("not-a-url")).toBe(true);
  });

  it("blocks empty string", () => {
    expect(isBlockedUrl("")).toBe(true);
  });

  it("blocks ftp:// scheme", () => {
    expect(isBlockedUrl("ftp://example.com/")).toBe(true);
  });

  // ---- boundary values for 127.x.x.x ----

  it("blocks 127.255.255.255 (upper boundary of loopback range)", () => {
    expect(isBlockedUrl("http://127.255.255.255/")).toBe(true);
  });

  // ---- SSRF bypass: IPv4-mapped IPv6 for private ranges ----

  it("blocks IPv4-mapped IPv6 for 10.0.0.1 → ::ffff:0a00:0001", () => {
    expect(isBlockedUrl("http://[::ffff:0a00:0001]/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 for 172.16.0.1 → ::ffff:ac10:0001", () => {
    expect(isBlockedUrl("http://[::ffff:ac10:0001]/")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 for link-local 169.254.0.1 → ::ffff:a9fe:0001", () => {
    expect(isBlockedUrl("http://[::ffff:a9fe:0001]/")).toBe(true);
  });

  // ---- boundary values for 172.16-31 range ----

  it("blocks 172.16.0.0 (exact lower boundary of RFC-1918 range)", () => {
    expect(isBlockedUrl("http://172.16.0.0/")).toBe(true);
  });

  it("allows 172.15.255.255 (just below RFC-1918 range)", () => {
    expect(isBlockedUrl("http://172.15.255.255/")).toBe(false);
  });

  // ---- 追加: resolveHostname の境界ケース ----

  it("blocks decimal-encoded 0.0.0.0 → 0", () => {
    expect(isBlockedUrl("http://0/")).toBe(true);
  });

  it("blocks hex-encoded 0.0.0.0 → 0x00000000", () => {
    expect(isBlockedUrl("http://0x00000000/")).toBe(true);
  });

  it("allows IPv4-mapped IPv6 pointing to public IP ::ffff:1.1.1.1", () => {
    expect(isBlockedUrl("http://[::ffff:1.1.1.1]/")).toBe(false);
  });

  it("allows IPv4-mapped IPv6 hex-group for public IP ::ffff:0101:0101 (1.1.1.1)", () => {
    expect(isBlockedUrl("http://[::ffff:0101:0101]/")).toBe(false);
  });

  it("blocks decimal-encoded 192.168.1.1 → 3232235777", () => {
    expect(isBlockedUrl("http://3232235777/")).toBe(true);
  });

  it("blocks hex-encoded 10.0.0.1 → 0x0a000001", () => {
    expect(isBlockedUrl("http://0x0a000001/")).toBe(true);
  });

  it("blocks javascript: scheme", () => {
    expect(isBlockedUrl("javascript:alert(1)")).toBe(true);
  });

  // ---- URL正規化・ポート番号 ----

  it("blocks 127.0.0.1 even with port number", () => {
    expect(isBlockedUrl("http://127.0.0.1:8080/")).toBe(true);
    expect(isBlockedUrl("http://127.0.0.1:65535/some/path")).toBe(true);
  });

  it("blocks uppercase LOCALHOST (URL parser normalizes to lowercase)", () => {
    expect(isBlockedUrl("http://LOCALHOST/")).toBe(true);
    expect(isBlockedUrl("http://Localhost:3000/")).toBe(true);
  });

  it("blocks 10.0.0.1 with port number", () => {
    expect(isBlockedUrl("http://10.0.0.1:9000/api")).toBe(true);
  });

  // ---- resolveHostname: 境界値 (uint32 超過) ----

  it("blocks decimal integer exceeding uint32 (4294967296) via URL parse failure", () => {
    // WHATWG URL spec: 4294967296 > 0xffffffff → Invalid URL → catch → blocked
    expect(isBlockedUrl("http://4294967296/")).toBe(true);
  });

  it("blocks hex integer exceeding uint32 (0x100000000) via URL parse failure", () => {
    // WHATWG URL spec: 0x100000000 > 0xffffffff → Invalid URL → catch → blocked
    expect(isBlockedUrl("http://0x100000000/")).toBe(true);
  });

  it("allows decimal IP in valid uint32 range pointing to public address (1234567890 = 73.150.2.210)", () => {
    // 1234567890 = 0x499602D2 = 73.150.2.210 → public IP → allowed
    expect(isBlockedUrl("http://1234567890/")).toBe(false);
  });

  // ---- 無効な IPv6 ----

  it("blocks ::ffff: with invalid non-hex suffix via URL parse failure", () => {
    // ::ffff:zzzz は無効な IPv6 → Invalid URL → catch → blocked
    expect(isBlockedUrl("http://[::ffff:zzzz]/")).toBe(true);
  });
});
