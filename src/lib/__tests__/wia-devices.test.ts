import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCAN_COLOR,
  DEFAULT_SCAN_DPI,
  DEFAULT_SCAN_FORMAT,
  SCAN_COLORS,
  SCAN_DPIS,
  parseWiaDeviceList,
} from "@/lib/scanner";

describe("parseWiaDeviceList", () => {
  it("parses DEVICE lines into records", () => {
    const stdout = [
      "DEVICE|1|{GUID-1}|HP LaserJet MFP M28-M31",
      "DEVICE|2|{GUID-2}|Canon MF440 Series",
      "OK",
    ].join("\r\n");
    expect(parseWiaDeviceList(stdout)).toEqual([
      { index: 1, deviceId: "{GUID-1}", name: "HP LaserJet MFP M28-M31" },
      { index: 2, deviceId: "{GUID-2}", name: "Canon MF440 Series" },
    ]);
  });

  it("ignores noise and malformed lines, returns [] when empty", () => {
    expect(parseWiaDeviceList("NO_SCANNER\r\n")).toEqual([]);
    expect(parseWiaDeviceList("")).toEqual([]);
    expect(
      parseWiaDeviceList("WARNING: something\r\nDEVICE|bad|x\r\nDEVICE|1||\r\nOK\r\n"),
    ).toEqual([]);
  });

  it("keeps names containing pipes and sorts by index", () => {
    const stdout = "DEVICE|2|id2|Name|With|Pipes\r\nDEVICE|1|id1|First\r\nOK\r\n";
    const [a, b] = parseWiaDeviceList(stdout);
    expect(a.index).toBe(1);
    expect(b.name).toBe("Name|With|Pipes");
  });
});

describe("scan option constants", () => {
  it("exposes sane defaults covered by the hardware route allowlists", () => {
    expect(SCAN_DPIS).toContain(DEFAULT_SCAN_DPI);
    expect(SCAN_COLORS.some((c) => c.id === DEFAULT_SCAN_COLOR)).toBe(true);
    expect(["pdf", "jpg", "png"]).toContain(DEFAULT_SCAN_FORMAT);
    // WIA ColorMode mapping: 0=B/W, 1=Gray, 2=Color.
    expect(SCAN_COLORS.find((c) => c.id === "color")?.wia).toBe(2);
    expect(SCAN_COLORS.find((c) => c.id === "gray")?.wia).toBe(1);
    expect(SCAN_COLORS.find((c) => c.id === "bw")?.wia).toBe(0);
  });
});
