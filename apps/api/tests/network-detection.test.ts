import { describe, expect, it } from "bun:test";
import type os from "node:os";
import { buildHostNetworkCandidates } from "../src/domains/plants/domain/network-detection";

function ipv4(address: string, cidr: string): os.NetworkInterfaceInfo {
  return {
    address,
    netmask: "255.255.255.0",
    family: "IPv4",
    mac: "00:11:22:33:44:55",
    internal: false,
    cidr,
  };
}

describe("network detection", () => {
  it("ignores virtual link-local interfaces and keeps the real LAN candidate", () => {
    const candidates = buildHostNetworkCandidates(
      {
        vint_runtime: [ipv4("169.254.100.6", "169.254.100.4/30")],
        Ethernet: [ipv4("192.168.100.27", "192.168.100.0/24")],
      },
      [],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.interfaceName).toBe("Ethernet");
    expect(candidates[0]?.ipAddress).toBe("192.168.100.27");
  });

  it("inherits wifi identity for a wired interface on the same subnet", () => {
    const candidates = buildHostNetworkCandidates(
      {
        Ethernet: [ipv4("192.168.100.27", "192.168.100.0/24")],
        "Wi-Fi": [ipv4("192.168.100.31", "192.168.100.0/24")],
      },
      [
        {
          interfaceName: "Wi-Fi",
          ssid: "USINA_OPERACAO",
          bssid: "AA:BB:CC:DD:EE:FF",
        },
      ],
    );

    const ethernetCandidate = candidates.find(
      (candidate) => candidate.interfaceName === "Ethernet",
    );

    expect(ethernetCandidate).toBeDefined();
    expect(ethernetCandidate?.ssid).toBe("USINA_OPERACAO");
    expect(ethernetCandidate?.bssid).toBe("AA:BB:CC:DD:EE:FF");
  });
});
