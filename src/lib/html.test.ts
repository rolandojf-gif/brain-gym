import { describe, expect, it } from 'vitest';
import { esc, urlSegura } from './html';

describe('html', () => {
  it('esc escapa los caracteres peligrosos', () => {
    expect(esc(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    expect(esc(undefined)).toBe('');
  });
  it('urlSegura sólo admite http y https', () => {
    expect(urlSegura('https://aeon.co/essays/x')).toBe('https://aeon.co/essays/x');
    expect(urlSegura('javascript:alert(1)')).toBe('');
    expect(urlSegura('data:text/html,hola')).toBe('');
    expect(urlSegura('no es una url')).toBe('');
    expect(urlSegura(undefined)).toBe('');
  });
});
