export default function EqIcon({
  index = 0,
  size = 32,
  cols = 6,
  sheet = '/stone-ui/itemicons/items1.png',
  className = ''
}) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const style = {
    '--eq-icon-size': `${size}px`,
    '--eq-icon-col': col,
    '--eq-icon-row': row,
    '--eq-icon-cols': cols,
    backgroundImage: `url(${sheet})`
  };
  return <div className={`eq-icon ${className}`} style={style} aria-hidden="true" />;
}
