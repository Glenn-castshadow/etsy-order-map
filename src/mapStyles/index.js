import heatmap from './heatmap.js';
import bubbles from './bubbles.jsx';
import arcs from './arcs.jsx';

export const styles = [heatmap, bubbles, arcs];

export const stylesById = Object.fromEntries(styles.map(s => [s.id, s]));
