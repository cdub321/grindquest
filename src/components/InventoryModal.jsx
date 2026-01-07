import Icon from './Icon';
import { slotOrder, CARRY_START } from '../services/inventoryManager';
import { build_item_tooltip } from '../utils/itemUtils';
import { get_slot_labels } from '../utils/slotUtils';

export default function InventoryModal({
  slots = [],
  onSlotClick = () => {},
  onSlotRightClick = () => {},
  onDestroySlot = null,
  onInspectItem = () => {},
  onClose = () => {},
  selectedSlot = null,
  getItemFromSlot = null
}) {
  const equipmentSlots = slots.slice(0, CARRY_START);
  const inventorySlots = slots.slice(CARRY_START, CARRY_START + 8);

  // Get slot labels from utility (derived from slotOrder)
  const allSlotLabels = get_slot_labels();
  const equipmentSlotLabels = allSlotLabels.slice(0, CARRY_START);
  const selectedItem = getItemFromSlot && selectedSlot !== null ? getItemFromSlot(selectedSlot) : null;

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
            title={build_item_tooltip(item)}
          >
            <div className="stone-slot__icon-wrap">
              {typeof item.icon_index === 'number' ? (
                <Icon index={item.icon_index} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
              ) : (
                <div className="stone-slot__icon-fallback" />
              )}
              {item.bag_slots && item.contents ? (
                <span className="stone-slot__qty">
                  x{item.contents.filter(c => c).length}/{item.bag_slots}
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
      <div className="stone-modal" style={{ maxWidth: 720, minWidth: 520, width: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="stone-modal__header">
          <h2 className="stone-modal__title">Inventory</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onDestroySlot && selectedItem ? (
              <button className="stone-button" onClick={() => onDestroySlot(selectedSlot)}>Destroy</button>
            ) : null}
            <button className="stone-modal__close" onClick={onClose}>X</button>
          </div>
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
            if (!bag || !bag.bag_slots) return null;
            const inventorySlotId = slotOrder[CARRY_START + invIdx];
            const bagContents = bag.contents || Array(bag.bag_slots).fill(null);

            return (
              <div key={`bag-${invIdx}`} className="stone-inventory-section">
                <h3 className="stone-inventory-section__title">
                  {bag.name || `Bag ${invIdx + 1}`} ({bagContents.filter(c => c).length}/{bag.bag_slots})
                </h3>
                <div className="stone-inventory-grid stone-inventory-grid--bag">
                  {bagContents.map((item, bagContentIdx) => {
                    // Calculate actual bag slot ID: (inventory_slot_id - 30 + 1) * 100 + position
                    const bagSlotId = (inventorySlotId - 30 + 1) * 100 + bagContentIdx;

                    return (
                      <div
                        key={bagContentIdx}
                        className={`stone-slot ${selectedSlot === bagSlotId ? 'stone-slot--selected' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.shiftKey && item) {
                            onInspectItem(item);
                          } else {
                            onSlotClick(bagSlotId);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item && item.stackable && item.quantity > 1) {
                            onSlotRightClick(bagSlotId);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {item ? (
                          <div
                            className="stone-slot__item"
                            role="button"
                            tabIndex={0}
                            title={build_item_tooltip(item)}
                          >
                            <div className="stone-slot__icon-wrap">
                              {typeof item.icon_index === 'number' ? (
                                <Icon index={item.icon_index} size={32} cols={6} sheet="/stone-ui/itemicons/items1.png" />
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
