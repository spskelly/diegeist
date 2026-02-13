import { describe, it, expect } from 'vitest';
import { MessageLog } from '../src/message-log.js';

describe('MessageLog', () => {
  it('starts with no messages', () => {
    const log = new MessageLog();
    expect(log.messages).toHaveLength(0);
  });

  it('adds messages with default turn of 0', () => {
    const log = new MessageLog();
    log.add('You move north.');
    expect(log.messages).toHaveLength(1);
    expect(log.messages[0].text).toBe('You move north.');
    expect(log.messages[0].turn).toBe(0);
  });

  it('tracks the turn number for each message', () => {
    const log = new MessageLog();
    log.add('First', 1);
    log.add('Second', 3);
    expect(log.messages[0].turn).toBe(1);
    expect(log.messages[1].turn).toBe(3);
  });

  it('returns recent messages up to a limit', () => {
    const log = new MessageLog();
    for (let i = 0; i < 10; i++) log.add(`Msg ${i}`);
    const recent = log.getRecent(4);
    expect(recent).toHaveLength(4);
    expect(recent[0].text).toBe('Msg 6');
    expect(recent[3].text).toBe('Msg 9');
  });

  it('returns all messages if fewer than requested', () => {
    const log = new MessageLog();
    log.add('Only one');
    const recent = log.getRecent(4);
    expect(recent).toHaveLength(1);
    expect(recent[0].text).toBe('Only one');
  });

  it('caps total messages to prevent unbounded growth', () => {
    const log = new MessageLog(50);
    for (let i = 0; i < 60; i++) log.add(`Msg ${i}`);
    expect(log.messages).toHaveLength(50);
    expect(log.messages[0].text).toBe('Msg 10');
  });

  it('uses default max of 200 messages', () => {
    const log = new MessageLog();
    for (let i = 0; i < 210; i++) log.add(`Msg ${i}`);
    expect(log.messages).toHaveLength(200);
  });

  it('getRecent with default count returns 4', () => {
    const log = new MessageLog();
    for (let i = 0; i < 10; i++) log.add(`Msg ${i}`);
    const recent = log.getRecent();
    expect(recent).toHaveLength(4);
  });
});
