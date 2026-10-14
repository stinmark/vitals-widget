//Helper to wrap path data in a standard 64x64 SVG container
const wrap = (content) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">
    ${content}
</svg>`;

export const ICONS = {
    cpu: (color) => wrap(`
        <path d="M 19 16 L 45 16 C 46.6569 16 48 17.3431 48 19 L 48 45 C 48 46.6569 46.6569 48 45 48 L 19 48 C 17.3431 48 16 46.6569 16 45 L 16 19 C 16 17.3431 17.3431 16 19 16 Z" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 24 24 L 40 24 L 40 40 L 24 40 Z" fill="${color}"/>
        <path d="M 8 18 L 16 18" stroke="${color}" stroke-width="4"/>
        <path d="M 8 30 L 16 30" stroke="${color}" stroke-width="4"/>
        <path d="M 8 42 L 16 42" stroke="${color}" stroke-width="4"/>
        <path d="M 48 18 L 56 18" stroke="${color}" stroke-width="4"/>
        <path d="M 48 30 L 56 30" stroke="${color}" stroke-width="4"/>
        <path d="M 48 42 L 56 42" stroke="${color}" stroke-width="4"/>
        <path d="M 18 8 L 18 16" stroke="${color}" stroke-width="4"/>
        <path d="M 30 8 L 30 16" stroke="${color}" stroke-width="4"/>
        <path d="M 42 8 L 42 16" stroke="${color}" stroke-width="4"/>
        <path d="M 18 48 L 18 56" stroke="${color}" stroke-width="4"/>
        <path d="M 30 48 L 30 56" stroke="${color}" stroke-width="4"/>
        <path d="M 42 48 L 42 56" stroke="${color}" stroke-width="4"/>
    `),
    gpu: (color) => wrap(`
        <path d="M 14 20 L 50 20 C 51.1046 20 52 20.8954 52 22 L 52 42 C 52 43.1046 51.1046 44 50 44 L 14 44 C 12.8954 44 12 43.1046 12 42 L 12 22 C 12 20.8954 12.8954 20 14 20 Z" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 20 28 L 28 28 L 28 36 L 20 36 Z" fill="${color}"/>
        <path d="M 36 28 L 44 28 L 44 36 L 36 36 Z" fill="${color}"/>
        <path d="M 4 22 L 12 22" stroke="${color}" stroke-width="4"/>
        <path d="M 4 30 L 12 30" stroke="${color}" stroke-width="4"/>
        <path d="M 4 38 L 12 38" stroke="${color}" stroke-width="4"/>
        <path d="M 52 28 L 60 28 L 60 36 L 52 36 Z" fill="${color}"/>
        <path d="M 20 44 L 20 52 L 44 52 L 44 44" stroke="${color}" stroke-width="4" fill="none"/>
        <path d="M 26 52 L 26 56" stroke="${color}" stroke-width="4"/>
        <path d="M 34 52 L 34 56" stroke="${color}" stroke-width="4"/>
    `),
    ram: (color) => wrap(`
        <path d="M 10 20 L 54 20 C 55.1046 20 56 20.8954 56 22 L 56 46 C 56 47.1046 55.1046 48 54 48 L 10 48 C 8.89543 48 8 47.1046 8 46 L 8 22 C 8 20.8954 8.89543 20 10 20 Z" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 16 28 L 22 28 L 22 40 L 16 40 Z" fill="${color}"/>
        <path d="M 29 28 L 35 28 L 35 40 L 29 40 Z" fill="${color}"/>
        <path d="M 42 28 L 48 28 L 48 40 L 42 40 Z" fill="${color}"/>
        <path d="M 10 48 L 10 52" stroke="${color}" stroke-width="4"/>
        <path d="M 54 48 L 54 52" stroke="${color}" stroke-width="4"/>
        <path d="M 22 48 L 22 52" stroke="${color}" stroke-width="4"/>
        <path d="M 42 48 L 42 52" stroke="${color}" stroke-width="4"/>
        <path d="M 14 12 L 14 20" stroke="${color}" stroke-width="4"/>
        <path d="M 30 12 L 30 20" stroke="${color}" stroke-width="4"/>
        <path d="M 46 12 L 46 20" stroke="${color}" stroke-width="4"/>
    `),
    storage: (color) => wrap(`
        <path d="M 12 16 C 12 11.58 20.956 8 32 8 C 43.044 8 52 11.58 52 16" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 52 16 C 52 20.42 43.044 24 32 24 C 20.956 24 12 20.42 12 16" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 12 16 L 12 48 C 12 52.4 20.8 56 32 56 C 43.2 56 52 52.4 52 48 L 52 16" fill="none" stroke="${color}" stroke-width="6"/>
        <path d="M 12 32 C 12 36.42 20.956 38 32 38 C 43.044 38 52 36.42 52 32" fill="none" stroke="${color}" stroke-width="4"/>
        <path d="M 12 48 C 12 52.4 20.8 56 32 56 C 43.2 56 52 52.4 52 48" fill="${color}" opacity="0.3"/>
        <path d="M 44 24 C 44 25.768 42.232 27.2 40 27.2 C 37.768 27.2 36 25.768 36 24 C 36 22.232 37.768 20.8 40 20.8 C 42.232 20.8 44 22.232 44 24 Z" fill="${color}"/>
        <path d="M 44 40 C 44 41.768 42.232 43.2 40 43.2 C 37.768 43.2 36 41.768 36 40 C 36 38.232 37.768 36.8 40 36.8 C 42.232 36.8 44 38.232 44 40 Z" fill="${color}"/>
    `),
    temp: (color) => wrap(`
        <path d="M 28 8 L 28 36 C 22 38 20 42 20 46 C 20 52 25.2 56 32 56 C 38.8 56 44 52 44 46 C 44 42 42 38 36 36 L 36 8 Z" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M 32 54 C 36.4183 54 40 50.4183 40 46 C 40 41.5817 36.4183 38 32 38 C 27.5817 38 24 41.5817 24 46 C 24 50.4183 27.5817 54 32 54 Z" fill="${color}"/>
        <path d="M 30 36 L 30 16" stroke="${color}" stroke-width="8"/>
        <path d="M 38 16 L 40 16" stroke="${color}" stroke-width="3.2"/>
        <path d="M 38 24 L 40 24" stroke="${color}" stroke-width="3.2"/>
        <path d="M 38 32 L 40 32" stroke="${color}" stroke-width="3.2"/>
    `),
};
