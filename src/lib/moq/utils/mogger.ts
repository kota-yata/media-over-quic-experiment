type Role = 'Subscriber' | 'Publisher';

export class Mogger {
  private role: Role;
  constructor(role: Role) {
    this.role = role;
  }
  private getCaller() {
    const error = new Error();
    const stack = error.stack || '';
    const stackLines = stack.split('\n');
    const callerIndex = stackLines.findIndex(line => line.includes('getCaller')) + 2;
    if (stackLines[callerIndex]) return stackLines[callerIndex].trim();
    return 'Unknown';
}
  public info(text: string) {
    console.info(`${this.role}: ${text}`);
  }
  public error(text: string) {
    console.error(`${this.role}: ${this.getCaller()}: ${text}`);
  }
}
