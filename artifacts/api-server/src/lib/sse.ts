import { Response } from "express";

type NotificationMessage = {
  type: string;
  actorName: string;
  actionMessage: string;
};

// userId -> Set of connections
const clients = new Map<number, Set<Response>>();

export const sseManager = {
  addClient(userId: number, res: Response) {
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(res);

    // Remove client on close
    res.on("close", () => {
      this.removeClient(userId, res);
    });
  },

  removeClient(userId: number, res: Response) {
    const userClients = clients.get(userId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  },

  notifyUser(userId: number, data: NotificationMessage) {
    const userClients = clients.get(userId);
    if (userClients) {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      userClients.forEach((client) => {
        try {
          client.write(message);
        } catch (err) {
          // Ignore error and let "close" event handle cleanup
        }
      });
    }
  },
};
