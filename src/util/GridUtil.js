export function isInBounds(col, row, cols, rows) {
    return col >= 0 && col < cols && row >= 0 && row < rows;
}

export function gridToKey(col, row) {
    return `${col},${row}`;
}

export function keyToGrid(key) {
    const [col, row] = key.split(',').map(Number);
    return { col, row };
}

export function getAdjacentSquares(col, row, cols, rows) {
    const dirs = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1],
    ];
    return dirs
        .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
        .filter(p => isInBounds(p.col, p.row, cols, rows));
}

export function forEachSquare(cols, rows, fn) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            fn(c, r);
        }
    }
}

export function algebraicNotation(col, row) {
    return String.fromCharCode(97 + col) + (row + 1);
}
