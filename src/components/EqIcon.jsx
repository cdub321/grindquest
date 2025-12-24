export default function EqIcon({
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
  offsetY = null
}) {
  // Calculate icons per sheet
  const iconsPerSheet = cols * rows;

  // Determine which sheet to use based on the index
  const sheetNumber = Math.floor(index / iconsPerSheet) + 1;
  const localIndex = index % iconsPerSheet;

  // Auto-page only for known sprite bases ending in "1.png"
  const inferSheetBase = () => {
    if (sheet.endsWith('/itemicons/items1.png')) return '/stone-ui/itemicons/items';
    if (sheet.endsWith('/spellicons/spells1.png')) return '/stone-ui/spellicons/spells';
    return null;
  };
  const base = inferSheetBase();
  const actualSheet = base ? `${base}${sheetNumber}.png` : sheet;

  const col = localIndex % cols;
  const row = Math.floor(localIndex / cols);

  const style = {
    '--eq-icon-size': `${size}px`,
    '--eq-icon-size-x': sizeX ? `${sizeX}px` : `${size}px`,
    '--eq-icon-size-y': sizeY ? `${sizeY}px` : `${size}px`,
    '--eq-icon-cols': cols,
    '--eq-icon-rows': rows,
    ...(stepX !== null ? { '--eq-icon-step-x': `${stepX}px` } : {}),
    ...(stepY !== null ? { '--eq-icon-step-y': `${stepY}px` } : {}),
    '--eq-icon-col': col,
    '--eq-icon-row': row,
    ...(offsetX !== null ? { '--eq-icon-offset-x': `${offsetX}px` } : {}),
    ...(offsetY !== null ? { '--eq-icon-offset-y': `${offsetY}px` } : {}),
    backgroundImage: `url(${actualSheet})`
  };
  return <div className={`eq-icon ${className}`} style={style} aria-hidden="true" />;
}
