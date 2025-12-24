import EqIcon from './EqIcon';

// Single source of truth for gem appearance
export const GEM_CONFIG = {
  sheetBase: '/stone-ui/spellicons/gemicons',
  cols: 7,
  rows: 9,
  sheetSize: 512, // px
  defaultWidth: 44,  // display width
  defaultHeight: 33, // display height
  defaultZoom: .6,   // sprite zoom multiplier
  defaultOffsetX: -1,
  defaultOffsetY: -1
};

export default function GemIcon({
  index = 0,
  width = GEM_CONFIG.defaultWidth,
  height = GEM_CONFIG.defaultHeight,
  zoom = GEM_CONFIG.defaultZoom,
  offsetX = GEM_CONFIG.defaultOffsetX,
  offsetY = GEM_CONFIG.defaultOffsetY
}) {
  const { cols, rows, sheetBase, sheetSize } = GEM_CONFIG;
  const iconsPerPage = cols * rows;
  const page = Math.floor(index / iconsPerPage) + 1;
  const sheet = `${sheetBase}${page}.png`;
  const stepX = (sheetSize / cols) * zoom;
  const stepY = (sheetSize / rows) * zoom;

  return (
    <EqIcon
      index={index % iconsPerPage}
      sheet={sheet}
      cols={cols}
      rows={rows}
      sizeX={width}
      sizeY={height}
      stepX={stepX}
      stepY={stepY}
      offsetX={offsetX}
      offsetY={offsetY}
      className="eq-icon--gem"
    />
  );
}
