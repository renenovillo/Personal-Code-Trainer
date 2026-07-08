// Adaptador de persistencia: replica la API window.storage de los artifacts
// de Claude usando localStorage del navegador. Así App.jsx no necesita cambios.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem('codegym:' + key);
      if (value === null) throw new Error('Key not found: ' + key);
      return { key, value };
    },
    async set(key, value) {
      localStorage.setItem('codegym:' + key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem('codegym:' + key);
      return { key, deleted: true };
    },
    async list(prefix = '') {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('codegym:' + prefix)) keys.push(k.slice('codegym:'.length));
      }
      return { keys };
    },
  };
}
