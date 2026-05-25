import heatmap from './heatmap.js';
import bubbles from './bubbles.jsx';

export const styles = [heatmap, bubbles];

export const stylesById = Object.fromEntries(styles.map(s => [s.id, s]));
