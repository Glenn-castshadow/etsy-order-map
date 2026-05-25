import heatmap from './heatmap.js';

export const styles = [heatmap];

export const stylesById = Object.fromEntries(styles.map(s => [s.id, s]));
