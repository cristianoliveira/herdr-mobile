import { requireNativeModule, type EventSubscription } from "expo-modules-core";

type Events = {
  onData: (e: { id: string; data: string }) => void;
  onClose: (e: { id: string; reason: string | null }) => void;
};

type HcSshModule = {
  publicKey(): Promise<string>;
  open(id: string, host: string, port: number, user: string, command: string, knownHostKey: string | null): Promise<{ hostKey: string }>;
  write(id: string, base64: string): void;
  close(id: string): void;
  addListener<K extends keyof Events>(event: K, listener: Events[K]): EventSubscription;
};

export const HcSsh = requireNativeModule<HcSshModule>("HcSsh");
