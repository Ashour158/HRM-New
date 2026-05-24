import { describe, it, expect } from 'vitest';
import { Ok, Err } from './result.js';
import { Some, None } from './option.js';

describe('Result', () => {
  it('Ok wraps a value and reports success', () => {
    const r = new Ok(42);
    expect(r.isOk()).toBe(true);
    expect(r.isErr()).toBe(false);
    expect(r.unwrap()).toBe(42);
  });

  it('Err wraps an error and reports failure', () => {
    const r = new Err('oops');
    expect(r.isOk()).toBe(false);
    expect(r.isErr()).toBe(true);
    expect(() => r.unwrap()).toThrow('oops');
  });

  it('map transforms Ok value', () => {
    const r = new Ok(2).map((n) => n * 3);
    expect(r.unwrap()).toBe(6);
  });

  it('map is no-op on Err', () => {
    const r = new Err<string, number>(42).map((s) => s.toUpperCase());
    expect(r.isErr()).toBe(true);
  });

  it('flatMap chains Results', () => {
    const r = new Ok(2).flatMap((n) => new Ok(n * 3));
    expect(r.unwrap()).toBe(6);
  });

  it('flatMap short-circuits on Err', () => {
    const r = new Err<string, string>('fail').flatMap((s) => new Ok(s.length));
    expect(r.isErr()).toBe(true);
  });

  it('match dispatches to correct arm', () => {
    const okResult = new Ok(5).match(
      (n) => `value:${n}`,
      (_e) => 'error',
    );
    expect(okResult).toBe('value:5');

    const errResult = new Err('bad').match(
      (_n) => 'value',
      (e) => `error:${e}`,
    );
    expect(errResult).toBe('error:bad');
  });

  it('unwrapOr returns value for Ok and default for Err', () => {
    expect(new Ok(10).unwrapOr(99)).toBe(10);
    expect(new Err('fail').unwrapOr(99)).toBe(99);
  });
});

describe('Option', () => {
  it('Some holds a value', () => {
    const o = new Some(42);
    expect(o.isSome()).toBe(true);
    expect(o.isNone()).toBe(false);
    expect(o.unwrap()).toBe(42);
  });

  it('None represents absence', () => {
    const o = new None<number>();
    expect(o.isSome()).toBe(false);
    expect(o.isNone()).toBe(true);
    expect(() => o.unwrap()).toThrow();
  });

  it('map transforms Some and skips None', () => {
    expect(new Some(2).map((n) => n + 1).unwrap()).toBe(3);
    expect(new None<number>().map((n) => n + 1).isNone()).toBe(true);
  });

  it('unwrapOr returns value for Some and default for None', () => {
    expect(new Some(10).unwrapOr(99)).toBe(10);
    expect(new None<number>().unwrapOr(99)).toBe(99);
  });
});
