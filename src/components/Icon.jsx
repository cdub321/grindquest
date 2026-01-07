// Single source of truth for gem appearance
export const GEM_CONFIG = {
  sheetBase: '/stone-ui/spellicons/oldgems',
  cols: 10,
  rows: 10,
  sheetSize: 512, // px
  defaultWidth: 40,  // display width
  defaultHeight: 40, // display height
  defaultZoom: .80,   // sprite zoom multiplier
  defaultOffsetX: 0,
  defaultOffsetY: 0
};


/**
 * Unified icon component that handles both regular icons (EqIcon) and gem icons (GemIcon)
 * @param {number} index - Icon index in the sprite sheet
 * @param {number} size - Default size for square icons (used when sizeX/sizeY not provided)
 * @param {number} sizeX - Width override
 * @param {number} sizeY - Height override
 * @param {number} cols - Number of columns in sprite sheet
 * @param {number} rows - Number of rows in sprite sheet
 * @param {number} stepX - Step size for X axis (calculated automatically for gems)
 * @param {number} stepY - Step size for Y axis (calculated automatically for gems)
 * @param {string} sheet - Sprite sheet path
 * @param {string} className - Additional CSS classes
 * @param {number} offsetX - X offset
 * @param {number} offsetY - Y offset
 * @param {boolean} isGem - If true, uses gem icon defaults and logic
 * @param {number} width - Gem width (only used when isGem=true)
 * @param {number} height - Gem height (only used when isGem=true)
 * @param {number} zoom - Gem zoom (only used when isGem=true)
 */
export default function Icon({
  index = 0,
  size = 32,
  sizeX = null,
  sizeY = null,
  cols = 6,
  rows = 6,
  stepX = null,
  stepY = null,
  sheet = '/stone-ui/itemicons/items1.png',
  className = '',
  offsetX = null,
  offsetY = null,
  isGem = false,
  width = null,
  height = null,
  zoom = null
}) {
  // Gem icon logic - apply gem-specific defaults
  let finalCols = cols;
  let finalRows = rows;
  let finalSheet = sheet;
  let finalSizeX = sizeX;
  let finalSizeY = sizeY;
  let finalStepX = stepX;
  let finalStepY = stepY;
  let finalOffsetX = offsetX;
  let finalOffsetY = offsetY;
  let finalClassName = className;
  let finalIndex = index;

  let localIndex;
  let actualSheet;
  
  if (isGem) {
    finalCols = GEM_CONFIG.cols;
    finalRows = GEM_CONFIG.rows;
    const iconsPerPage = finalCols * finalRows;
    const page = Math.floor(index / iconsPerPage) + 1;
    finalSheet = `${GEM_CONFIG.sheetBase}${page}.png`;
    localIndex = index % iconsPerPage;
    actualSheet = finalSheet; // Gems use the sheet directly, no auto-paging
    const gemZoom = zoom !== null ? zoom : GEM_CONFIG.defaultZoom;
    finalStepX = (GEM_CONFIG.sheetSize / finalCols) * gemZoom;
    finalStepY = (GEM_CONFIG.sheetSize / finalRows) * gemZoom;
    finalSizeX = width !== null ? width : GEM_CONFIG.defaultWidth;
    finalSizeY = height !== null ? height : GEM_CONFIG.defaultHeight;
    finalOffsetX = offsetX !== null ? offsetX : GEM_CONFIG.defaultOffsetX;
    finalOffsetY = offsetY !== null ? offsetY : GEM_CONFIG.defaultOffsetY;
    finalClassName = `${className} eq-icon--gem`.trim();
  } else {
    // Regular icon logic (original EqIcon)
    // Calculate icons per sheet
    const iconsPerSheet = finalCols * finalRows;
    
    // Item icons in database start at 500, but sprite sheet items1.png starts at icon 500
    // So we need to subtract 500 to get the 0-based position within the items sprite sheets
    // Example: database icon_index 592 -> sprite sheet position 92
    if (sheet.includes('/itemicons/')) {
      finalIndex = index - 500;
    }

    // Determine which sheet to use based on the index
    const sheetNumber = Math.floor(finalIndex / iconsPerSheet) + 1;
    localIndex = finalIndex % iconsPerSheet;

    // Auto-page only for known sprite bases ending in "1.png"
    const inferSheetBase = () => {
      if (finalSheet.endsWith('/itemicons/items1.png')) return '/stone-ui/itemicons/items';
      if (finalSheet.endsWith('/spellicons/spells1.png')) return '/stone-ui/spellicons/spells';
      return null;
    };
    const base = inferSheetBase();
    actualSheet = base ? `${base}${sheetNumber}.png` : finalSheet;
  }

  // For item icons, count vertically (column by column) instead of horizontally (row by row)
  // For gem icons and other icons (spells, etc.), count horizontally
  let col, row;
  if (!isGem && sheet.includes('/itemicons/')) {
    // Vertical counting: index 0 is top-left, index 1 is below it, etc.
    row = localIndex % finalRows;
    col = Math.floor(localIndex / finalRows);
  } else {
    // Horizontal counting: index 0 is top-left, index 1 is to the right, etc.
    col = localIndex % finalCols;
    row = Math.floor(localIndex / finalCols);
  }

  const style = {
    '--eq-icon-size': `${size}px`,
    '--eq-icon-size-x': finalSizeX ? `${finalSizeX}px` : `${size}px`,
    '--eq-icon-size-y': finalSizeY ? `${finalSizeY}px` : `${size}px`,
    '--eq-icon-cols': finalCols,
    '--eq-icon-rows': finalRows,
    ...(finalStepX !== null ? { '--eq-icon-step-x': `${finalStepX}px` } : {}),
    ...(finalStepY !== null ? { '--eq-icon-step-y': `${finalStepY}px` } : {}),
    '--eq-icon-col': col,
    '--eq-icon-row': row,
    ...(finalOffsetX !== null ? { '--eq-icon-offset-x': `${finalOffsetX}px` } : {}),
    ...(finalOffsetY !== null ? { '--eq-icon-offset-y': `${finalOffsetY}px` } : {}),
    backgroundImage: `url(${actualSheet})`
  };
  return <div className={`eq-icon ${finalClassName}`} style={style} aria-hidden="true" />;
}
