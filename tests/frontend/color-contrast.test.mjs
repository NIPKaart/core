import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../../resources/css/app.css', import.meta.url), 'utf8');

/** The first oklch() value of a custom property, optionally inside a block such as `:root {` or `.dark {`. */
function token(name, block = null) {
    const scope = block ? css.slice(css.indexOf(block), css.indexOf('}', css.indexOf(block))) : css;
    const match = scope.match(new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`));
    assert.ok(match, `--${name} is defined as oklch()`);

    return match.slice(1).map(Number);
}

/** Relative luminance of an OKLCH colour, via linear sRGB. */
function luminance([lightness, chroma, hue]) {
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const clamp = (value) => Math.min(1, Math.max(0, value));
    const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
    const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
    const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
}

test('muted text meets WCAG AA on every light surface it is used on', () => {
    const muted = token('muted-foreground', ':root {');
    const surfaces = {
        background: token('background', ':root {'),
        muted: token('muted', ':root {'),
        canvas: token('color-canvas'),
        'canvas-strong': token('color-canvas-strong'),
    };

    for (const [name, surface] of Object.entries(surfaces)) {
        assert.ok(contrast(muted, surface) >= 4.5, `muted text on ${name} is ${contrast(muted, surface).toFixed(2)}:1`);
    }
});

test('muted text meets WCAG AA on the dark background and muted surface', () => {
    const muted = token('muted-foreground', '.dark {');

    for (const name of ['background', 'muted']) {
        const surface = token(name, '.dark {');
        assert.ok(contrast(muted, surface) >= 4.5, `dark muted text on ${name} is ${contrast(muted, surface).toFixed(2)}:1`);
    }
});
