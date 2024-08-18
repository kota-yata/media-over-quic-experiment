// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }
}

interface Track { 
  namespace: string,
  name: string,
  alias?: string,
  subscribeIds: number[],
  type: string,
  priority: number,
}

export {
  Track
};
