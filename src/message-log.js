export class MessageLog {
  constructor(maxMessages = 200) {
    this.messages = [];
    this.maxMessages = maxMessages;
  }

  add(text, turn = 0, color = null) {
    this.messages.push({ text, turn, color });
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }
  }

  getRecent(count = 4) {
    return this.messages.slice(-count);
  }
}
