import EqIcon from './EqIcon';
import { slotOrder, CARRY_START } from '../services/inventoryManager';

export default function InventoryModal({
  slots = [],
  onSlotClick = () => {},
  onSlotRightClick = () => {},
  onInspectItem = () => {},
  onClose = () => {},
  selectedSlot = null
}) {
  const buildItemTooltip = (item) => {
    if (!item) return '';
    const lines = [];
    if (item.name) lines.push(item.name);
    if (item.slot) lines.push(`Slot: ${item.slot}`);
    if (item.quantity > 1) lines.push(`Qty: ${item.quantity}`);
    if (item.bonuses) {
      const bonusParts = Object.entries(item.bonuses)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`);
      if (bonusParts.length) lines.push(bonusParts.join('  '));
    }
    return lines.join('\n');
  };

  const equipmentSlots = slots.slice(0, CARRY_START);
  const inventorySlots = slots.slice(CARRY_START, CARRY_START + 8);

  const equipmentSlotLabels = [
    'Head', 'Face', 'Ear 1', 'Ear 2', 'Neck', 'Shoul.', 'Arms', 'Wr1st',
    'Wrist', 'Hands', 'Chest', 'Back', 'Waist', 'Legs', 'Feet', 'F1nger',
    'Finger', 'Pri', 'Sec', 'Range', 'Ammo', 'Charm'
  ];

  const renderSlot = (item, slotIndex, label) => {
    const isSelected = selectedSlot === slotIndex;
    return (
      <div
        key={slotIndex}
        className={`stone-slot ${isSelected ? 'stone-slot--selected' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey && item) {
            onInspectItem(item);
          } else {
            onSlotClick(slotIndex);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (item && item.stackable && item.quantity > 1) {
            onSlotRightClick(slotIndex);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        {item ? (
          <div
            className="stone-slot__item"
            role="button"
            tabIndex={0}
            title={buildItemTooltip(item)}
          >
            <div className="stone-slot__icon-wrap">
              {typeof item.iconIndex === 'number' ? (
                <EqIcon index={item.iconIndex} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
              ) : (
                <div className="stone-slot__icon-fallback" />
              )}
              {item.bagSlots && item.contents ? (
                <span className="stone-slot__qty">
                  x{item.contents.filter(c => c).length}/{item.bagSlots}
                </span>
              ) : item.quantity > 1 ? (
                <span className="stone-slot__qty">x{item.quantity}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <span className="stone-slot__ghost">{label}</span>
        )}
      </div>
    );
  };

  return (
    <div className="stone-modal-overlay" onClick={onClose}>
      <div className="stone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stone-modal__header">
          <h2 className="stone-modal__title">Inventory</h2>
          <button className="stone-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="stone-modal__body">
          {/* Equipment Slots Section */}
          <div className="stone-inventory-section">
            <h3 className="stone-inventory-section__title">Equipment</h3>
            <div className="stone-inventory-grid stone-inventory-grid--equipment">
              {equipmentSlots.map((item, idx) =>
                renderSlot(item, idx, equipmentSlotLabels[idx])
              )}
            </div>
          </div>

          {/* Inventory Slots Section */}
          <div className="stone-inventory-section">
            <h3 className="stone-inventory-section__title">Inventory Slots</h3>
            <div className="stone-inventory-grid stone-inventory-grid--inventory">
              {inventorySlots.map((item, idx) => {
                const slotIndex = CARRY_START + idx;
                return renderSlot(item, slotIndex, `${idx + 1}`);
              })}
            </div>
          </div>

          {/* Expanded Bags Section */}
          {inventorySlots.map((bag, invIdx) => {
            if (!bag || !bag.bagSlots || !bag.contents) return null;
            const bagSlotStartIndex = CARRY_START + invIdx;

            return (
              <div key={`bag-${invIdx}`} className="stone-inventory-section">
                <h3 className="stone-inventory-section__title">
                  {bag.name || `Bag ${invIdx + 1}`} ({bag.contents.filter(c => c).length}/{bag.bagSlots})
                </h3>
                <div className="stone-inventory-grid stone-inventory-grid--bag">
                  {bag.contents.map((item, bagContentIdx) => {
                    // Create a virtual slot index for bag contents
                    // We'll use negative indices to differentiate from main slots
                    const virtualSlotIndex = -(bagSlotStartIndex * 1000 + bagContentIdx);

                    return (
                      <div
                        key={bagContentIdx}
                        className={`stone-slot ${selectedSlot === virtualSlotIndex ? 'stone-slot--selected' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.shiftKey && item) {
                            onInspectItem(item);
                          } else {
                            // Pass bag slot info to parent
                            onSlotClick(virtualSlotIndex, { bagSlotIndex: bagSlotStartIndex, bagContentIndex: bagContentIdx });
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item && item.stackable && item.quantity > 1) {
                            onSlotRightClick(virtualSlotIndex, { bagSlotIndex: bagSlotStartIndex, bagContentIndex: bagContentIdx });
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {item ? (
                          <div
                            className="stone-slot__item"
                            role="button"
                            tabIndex={0}
                            title={buildItemTooltip(item)}
                          >
                            <div className="stone-slot__icon-wrap">
                              {typeof item.iconIndex === 'number' ? (
                                <EqIcon index={item.iconIndex} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
                              ) : (
                                <div className="stone-slot__icon-fallback" />
                              )}
                              {item.quantity > 1 && (
                                <span className="stone-slot__qty">x{item.quantity}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="stone-slot__ghost">{bagContentIdx + 1}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
