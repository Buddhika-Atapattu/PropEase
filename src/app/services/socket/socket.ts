// Path src/app/services/socket/socket.ts
// NOTE: This is just a placeholder you kept for future use.
// IMPORTANT: Renamed class to avoid clashing with `Socket` from socket.io-client.
// ALSO: Do not provide it in root to avoid creating a second, empty service.

import {Injectable} from '@angular/core';

@Injectable({
  providedIn: null, // <- not registered; prevents accidental DI conflicts
})
export class SocketPlaceholder {
  // Future: put any higher-level app abstractions here (if you need them later).
}
