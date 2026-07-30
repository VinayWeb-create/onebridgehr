import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';

class SocketService {
  private io: SocketServer | null = null;
  private userSockets: Map<string, string[]> = new Map(); // employeeId -> socketIds[]

  public init(server: HttpServer, frontendUrl: string) {
    this.io = new SocketServer(server, {
      cors: {
        origin: [frontendUrl, 'http://localhost:5173'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
      },
    });

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Register employee connection
      socket.on('register', (employeeId: string) => {
        if (!employeeId) return;
        
        const sockets = this.userSockets.get(employeeId) || [];
        if (!sockets.includes(socket.id)) {
          sockets.push(socket.id);
          this.userSockets.set(employeeId, sockets);
        }
        
        console.log(`Employee registered: ${employeeId} on socket ${socket.id}`);
        socket.emit('registered', { success: true });
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        
        // Remove disconnected socket
        for (const [employeeId, sockets] of this.userSockets.entries()) {
          const index = sockets.indexOf(socket.id);
          if (index !== -1) {
            sockets.splice(index, 1);
            if (sockets.length === 0) {
              this.userSockets.delete(employeeId);
            } else {
              this.userSockets.set(employeeId, sockets);
            }
            console.log(`Removed socket ${socket.id} for employee ${employeeId}`);
            break;
          }
        }
      });
    });
  }

  public sendNotification(employeeId: string, eventName: string, data: any) {
    if (!this.io) {
      console.warn('Socket.io server not initialized!');
      return false;
    }

    const socketIds = this.userSockets.get(employeeId);
    if (socketIds && socketIds.length > 0) {
      socketIds.forEach((socketId) => {
        this.io?.to(socketId).emit(eventName, data);
      });
      console.log(`Realtime notification sent to ${employeeId}:`, data);
      return true;
    }
    
    console.log(`Employee ${employeeId} is offline. Notification will be stored in database.`);
    return false;
  }

  public broadcast(eventName: string, data: any) {
    if (!this.io) return;
    this.io.emit(eventName, data);
  }
}

export const socketService = new SocketService();
export default socketService;
