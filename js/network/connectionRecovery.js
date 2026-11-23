/** Reports transport lifecycle changes and exposes a bounded reconnect helper. */
export function watchConnection(peer, notify) {
  peer.on('status', status => {
    notify(status);
    if (status === 'Peer disconnected') {
      notify('Peer terputus. Input remote dihentikan; gunakan sambungkan ulang untuk melanjutkan.');
    }
  });
}

/** Retry a guest connection a bounded number of times with exponential backoff. */
export async function reconnectGuest(peer, { attempts = 3, baseDelay = 400, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const limit = Math.max(1, Math.min(5, Math.floor(attempts)));
  for (let attempt = 0; attempt < limit; attempt++) {
    try {
      const connected = await peer.reconnect();
      if (connected) return true;
    } catch (error) {
      if (attempt === limit - 1) throw error;
    }
    if (attempt < limit - 1) await wait(Math.min(4000, baseDelay * (2 ** attempt)));
  }
  return false;
}
