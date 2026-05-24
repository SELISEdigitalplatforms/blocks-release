import { HttpTransportType, HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { getRuntimeEnv } from "@/lib/runtime-env";

// The NotificationHub is hosted on the logic server (same origin the
// logicService http client talks to), resolved from runtime env.
const logicOrigin = (): string =>
  getRuntimeEnv("BLOCKS_LOGIC_APP_URL").trim().replace(/\/$/, "");

export class NotificationClientService {
  public connection: HubConnection;

  constructor() {
    this.connection = new HubConnectionBuilder()
      .withUrl(
        `${logicOrigin()}/NotificationHub?x-blocks-key=${getRuntimeEnv("BLOCKS_X_BLOCKS_KEY")}`,
        {
          transport: HttpTransportType.WebSockets,
        },
      )
      .withAutomaticReconnect()
      .build();
    this.connect();
  }

  async connect() {
    this.connection.start();
  }

  async disconnect() {
    if (this.connection.state !== "Disconnected") {
      await this.connection.stop();
    }
  }
}

export const notificationClientService = new NotificationClientService();
