export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
}

export function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    return rgbToHex(
        c1.r + (c2.r - c1.r) * t,
        c1.g + (c2.g - c1.g) * t,
        c1.b + (c2.b - c1.b) * t,
    );
}

export function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

export function brighten(hex, amount = 0.2) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(
        Math.min(255, r + 255 * amount),
        Math.min(255, g + 255 * amount),
        Math.min(255, b + 255 * amount),
    );
}

export function darken(hex, amount = 0.2) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(
        Math.max(0, r - 255 * amount),
        Math.max(0, g - 255 * amount),
        Math.max(0, b - 255 * amount),
    );
}
