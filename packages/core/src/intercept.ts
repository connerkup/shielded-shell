export type InterceptKind = "read" | "write" | "exec" | "network" | "audit" | "info";

export interface InterceptEvent {
  kind: InterceptKind;
  target: string;
  action: "allowed" | "blocked" | "warn";
  detail?: string;
}

export class InterceptLog {
  private events: InterceptEvent[] = [];

  emit(event: InterceptEvent): void {
    this.events.push(event);
    const prefix = "[ShieldedShell]";
    const verb =
      event.action === "blocked"
        ? "Blocked"
        : event.action === "warn"
          ? "Warning"
          : "Allowed";
    const line = `${prefix} ${verb} ${event.kind.toUpperCase()}: ${event.target}${
      event.detail ? ` (${event.detail})` : ""
    }`;
    if (event.action === "blocked") {
      console.error(line);
    } else if (event.action === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  audit(message: string, detail?: string): void {
    this.emit({ kind: "audit", target: message, action: "allowed", detail });
  }

  info(message: string): void {
    this.emit({ kind: "info", target: message, action: "allowed" });
  }

  getEvents(): InterceptEvent[] {
    return [...this.events];
  }
}
